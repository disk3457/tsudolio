import { FacilityApplicationError } from "@/application/facilities/errors";
import type { FacilityRepository } from "@/application/facilities/use-cases";
import type {
  FacilityInput,
  FacilityReservationDecisionInput,
  FacilityReservationSummary,
  FacilitySnapshot,
  FacilityStatusTone,
  FacilitySummary,
} from "@/application/facilities/types";
import type { MutationContext } from "@/application/security/types";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";
import {
  AuditSeverity,
  FacilityStatus,
  WorkflowStatus,
} from "@generated/prisma/enums";

const activeReservationStatuses = [
  WorkflowStatus.PENDING,
  WorkflowStatus.APPROVED,
];

export async function getFacilitySnapshot(
  tenantCode: string,
): Promise<FacilitySnapshot> {
  const tenant = await getTenantOrThrow(tenantCode);
  const now = new Date();

  const [facilities, pendingReservations, organizationUnits] =
    await Promise.all([
      findFacilities(tenant.id, now),
      findPendingReservations(tenant.id, now),
      prisma.organizationUnit.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

  return {
    tenant: {
      code: tenant.code,
      name: tenant.displayName ?? tenant.name,
      timezone: tenant.timezone,
    },
    facilities: facilities.map(mapFacility),
    pendingReservations: pendingReservations.map(mapReservation),
    organizationUnits,
  };
}

export async function createFacility(
  input: FacilityInput,
  context: MutationContext,
): Promise<FacilitySummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);

  const facilityId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );
    await assertFacilityCodeIsUnique(tx, tenant.id, input.code, null);

    const facility = await tx.facility.create({
      data: {
        tenantId: tenant.id,
        organizationUnitId: input.organizationUnitId,
        code: input.code,
        name: input.name,
        status: input.status,
        capacity: input.capacity,
        location: input.location,
      },
      select: {
        id: true,
      },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "施設を作成",
      targetType: "facility",
      targetId: facility.id,
      severity: AuditSeverity.NOTICE,
      metadata: {
        code: input.code,
        name: input.name,
        status: input.status,
        organizationUnitId: input.organizationUnitId,
      },
    });

    return facility.id;
  });

  return getFacilitySummary(tenant.id, facilityId);
}

export async function updateFacility(
  facilityId: string,
  input: FacilityInput,
  context: MutationContext,
): Promise<FacilitySummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);

  const updatedFacilityId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );

    const existingFacility = await tx.facility.findFirst({
      where: {
        id: facilityId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
    });

    if (!existingFacility) {
      throw new FacilityApplicationError(
        "FACILITY_NOT_FOUND",
        "指定された施設が見つかりません。",
        404,
      );
    }

    await assertFacilityCodeIsUnique(tx, tenant.id, input.code, facilityId);

    await tx.facility.update({
      where: { id: facilityId },
      data: {
        organizationUnitId: input.organizationUnitId,
        code: input.code,
        name: input.name,
        status: input.status,
        capacity: input.capacity,
        location: input.location,
      },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "施設を更新",
      targetType: "facility",
      targetId: facilityId,
      severity: AuditSeverity.NOTICE,
      metadata: {
        before: {
          code: existingFacility.code,
          name: existingFacility.name,
          status: existingFacility.status,
        },
        after: {
          code: input.code,
          name: input.name,
          status: input.status,
          organizationUnitId: input.organizationUnitId,
        },
      },
    });

    return facilityId;
  });

  return getFacilitySummary(tenant.id, updatedFacilityId);
}

export async function deleteFacility(
  facilityId: string,
  context: MutationContext,
) {
  const tenant = await getTenantOrThrow(context.tenantCode);

  await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);

    const existingFacility = await tx.facility.findFirst({
      where: {
        id: facilityId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
    });

    if (!existingFacility) {
      throw new FacilityApplicationError(
        "FACILITY_NOT_FOUND",
        "指定された施設が見つかりません。",
        404,
      );
    }

    const reservationCount = await tx.facilityReservation.count({
      where: {
        tenantId: tenant.id,
        facilityId,
      },
    });

    if (reservationCount > 0) {
      throw new FacilityApplicationError(
        "FACILITY_HAS_RESERVATIONS",
        "予約履歴がある施設は削除できません。停止中へ変更してください。",
        409,
      );
    }

    await tx.facility.delete({
      where: { id: facilityId },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "施設を削除",
      targetType: "facility",
      targetId: facilityId,
      severity: AuditSeverity.WARNING,
      metadata: {
        code: existingFacility.code,
        name: existingFacility.name,
        status: existingFacility.status,
      },
    });
  });
}

export async function updateFacilityReservationStatus(
  reservationId: string,
  input: FacilityReservationDecisionInput,
  context: MutationContext,
): Promise<FacilityReservationSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);

  const updatedReservationId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);

    const existingReservation = await tx.facilityReservation.findFirst({
      where: {
        id: reservationId,
        tenantId: tenant.id,
      },
      include: {
        facility: true,
        event: true,
      },
    });

    if (!existingReservation) {
      throw new FacilityApplicationError(
        "RESERVATION_NOT_FOUND",
        "指定された施設予約が見つかりません。",
        404,
      );
    }

    assertReservationStatusTransition(existingReservation.status, input.status);

    if (input.status === WorkflowStatus.APPROVED) {
      await assertApprovedReservationIsOpen(tx, {
        tenantId: tenant.id,
        facilityId: existingReservation.facilityId,
        reservationId,
        startsAt: existingReservation.startsAt,
        endsAt: existingReservation.endsAt,
      });
    }

    await tx.facilityReservation.update({
      where: { id: reservationId },
      data: {
        status: input.status,
      },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "施設予約を更新",
      targetType: "facility_reservation",
      targetId: reservationId,
      severity:
        input.status === WorkflowStatus.APPROVED
          ? AuditSeverity.NOTICE
          : AuditSeverity.WARNING,
      metadata: {
        facilityId: existingReservation.facilityId,
        facilityName: existingReservation.facility.name,
        purpose: existingReservation.purpose,
        beforeStatus: existingReservation.status,
        afterStatus: input.status,
        startsAt: existingReservation.startsAt.toISOString(),
        endsAt: existingReservation.endsAt.toISOString(),
        eventId: existingReservation.eventId,
      },
    });

    return reservationId;
  });

  return getReservationSummary(tenant.id, updatedReservationId);
}

async function getTenantOrThrow(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new FacilityApplicationError(
      "TENANT_NOT_FOUND",
      `テナントが見つかりません: ${tenantCode}`,
      404,
    );
  }

  return tenant;
}

async function assertUserBelongsToTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
) {
  const actor = await tx.user.findFirst({
    where: {
      tenantId,
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!actor) {
    throw new FacilityApplicationError(
      "ACTOR_NOT_FOUND",
      "施設を操作する利用者が見つかりません。",
      404,
    );
  }
}

async function assertOrganizationBelongsToTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  organizationUnitId: string | null,
) {
  if (!organizationUnitId) {
    return;
  }

  const organizationUnit = await tx.organizationUnit.findFirst({
    where: {
      id: organizationUnitId,
      tenantId,
    },
    select: {
      id: true,
    },
  });

  if (!organizationUnit) {
    throw new FacilityApplicationError(
      "ORGANIZATION_UNIT_NOT_FOUND",
      "指定された管理組織が見つかりません。",
      404,
    );
  }
}

async function assertFacilityCodeIsUnique(
  tx: Prisma.TransactionClient,
  tenantId: string,
  code: string,
  excludingFacilityId: string | null,
) {
  const existingFacility = await tx.facility.findFirst({
    where: {
      tenantId,
      code,
      ...(excludingFacilityId
        ? {
            NOT: {
              id: excludingFacilityId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existingFacility) {
    throw new FacilityApplicationError(
      "FACILITY_CODE_CONFLICT",
      "同じ施設コードがすでに使われています。",
      409,
    );
  }
}

async function findFacilities(tenantId: string, now: Date) {
  return prisma.facility.findMany({
    where: {
      tenantId,
    },
    include: {
      organizationUnit: true,
      reservations: {
        where: {
          endsAt: {
            gte: now,
          },
          status: {
            in: activeReservationStatuses,
          },
        },
        orderBy: {
          startsAt: "asc",
        },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

async function findPendingReservations(tenantId: string, now: Date) {
  return prisma.facilityReservation.findMany({
    where: {
      tenantId,
      status: WorkflowStatus.PENDING,
      endsAt: {
        gte: now,
      },
    },
    include: {
      facility: true,
      event: true,
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
  });
}

type FacilityRecord = Awaited<ReturnType<typeof findFacilities>>[number];
type FacilityReservationRecord = Awaited<
  ReturnType<typeof findPendingReservations>
>[number];

async function getFacilitySummary(
  tenantId: string,
  facilityId: string,
): Promise<FacilitySummary> {
  const facility = await prisma.facility.findFirst({
    where: {
      id: facilityId,
      tenantId,
    },
    include: {
      organizationUnit: true,
      reservations: {
        where: {
          endsAt: {
            gte: new Date(),
          },
          status: {
            in: activeReservationStatuses,
          },
        },
        orderBy: {
          startsAt: "asc",
        },
      },
    },
  });

  if (!facility) {
    throw new FacilityApplicationError(
      "FACILITY_NOT_FOUND",
      "指定された施設が見つかりません。",
      404,
    );
  }

  return mapFacility(facility);
}

async function getReservationSummary(
  tenantId: string,
  reservationId: string,
): Promise<FacilityReservationSummary> {
  const reservation = await prisma.facilityReservation.findFirst({
    where: {
      id: reservationId,
      tenantId,
    },
    include: {
      facility: true,
      event: true,
    },
  });

  if (!reservation) {
    throw new FacilityApplicationError(
      "RESERVATION_NOT_FOUND",
      "指定された施設予約が見つかりません。",
      404,
    );
  }

  return mapReservation(reservation);
}

function mapFacility(facility: FacilityRecord): FacilitySummary {
  const nextReservation = facility.reservations[0] ?? null;
  const pendingReservationCount = facility.reservations.filter(
    (reservation) => reservation.status === WorkflowStatus.PENDING,
  ).length;

  return {
    id: facility.id,
    code: facility.code,
    name: facility.name,
    status: facility.status,
    statusLabel: getFacilityStatusLabel(facility.status),
    tone: getFacilityTone(facility.status),
    capacity: facility.capacity,
    location: facility.location,
    organizationUnit: facility.organizationUnit
      ? {
          id: facility.organizationUnit.id,
          name: facility.organizationUnit.name,
        }
      : null,
    activeReservationCount: facility.reservations.length,
    pendingReservationCount,
    nextReservation: nextReservation
      ? {
          id: nextReservation.id,
          startsAt: nextReservation.startsAt.toISOString(),
          endsAt: nextReservation.endsAt.toISOString(),
          purpose: nextReservation.purpose,
          status: nextReservation.status,
          statusLabel: getWorkflowStatusLabel(nextReservation.status),
        }
      : null,
    createdAt: facility.createdAt.toISOString(),
    updatedAt: facility.updatedAt.toISOString(),
  };
}

function mapReservation(
  reservation: FacilityReservationRecord,
): FacilityReservationSummary {
  return {
    id: reservation.id,
    purpose: reservation.purpose,
    startsAt: reservation.startsAt.toISOString(),
    endsAt: reservation.endsAt.toISOString(),
    status: reservation.status,
    statusLabel: getWorkflowStatusLabel(reservation.status),
    facility: {
      id: reservation.facility.id,
      name: reservation.facility.name,
      status: reservation.facility.status,
      statusLabel: getFacilityStatusLabel(reservation.facility.status),
    },
    event: reservation.event
      ? {
          id: reservation.event.id,
          title: reservation.event.title,
        }
      : null,
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
  };
}

function assertReservationStatusTransition(
  currentStatus: string,
  nextStatus: FacilityReservationDecisionInput["status"],
) {
  if (
    (nextStatus === WorkflowStatus.APPROVED ||
      nextStatus === WorkflowStatus.REJECTED) &&
    currentStatus !== WorkflowStatus.PENDING
  ) {
    throw new FacilityApplicationError(
      "INVALID_RESERVATION_STATE",
      "承認待ちの予約だけを承認または却下できます。",
      409,
    );
  }

  if (
    nextStatus === WorkflowStatus.CANCELED &&
    currentStatus !== WorkflowStatus.PENDING &&
    currentStatus !== WorkflowStatus.APPROVED
  ) {
    throw new FacilityApplicationError(
      "INVALID_RESERVATION_STATE",
      "承認待ちまたは予約済みの施設予約だけを取消できます。",
      409,
    );
  }
}

async function assertApprovedReservationIsOpen(
  tx: Prisma.TransactionClient,
  {
    tenantId,
    facilityId,
    reservationId,
    startsAt,
    endsAt,
  }: {
    tenantId: string;
    facilityId: string;
    reservationId: string;
    startsAt: Date;
    endsAt: Date;
  },
) {
  const conflict = await tx.facilityReservation.findFirst({
    where: {
      tenantId,
      facilityId,
      status: WorkflowStatus.APPROVED,
      startsAt: {
        lt: endsAt,
      },
      endsAt: {
        gt: startsAt,
      },
      NOT: {
        id: reservationId,
      },
    },
    select: {
      id: true,
    },
  });

  if (conflict) {
    throw new FacilityApplicationError(
      "RESERVATION_CONFLICT",
      "同じ時間帯に承認済みの施設予約があります。",
      409,
    );
  }
}

function getFacilityStatusLabel(status: string) {
  const labels: Record<string, string> = {
    [FacilityStatus.AVAILABLE]: "予約可",
    [FacilityStatus.IN_USE]: "利用中",
    [FacilityStatus.MAINTENANCE]: "停止中",
    [FacilityStatus.APPROVAL_REQUIRED]: "承認制",
  };

  return labels[status] ?? status;
}

function getFacilityTone(status: string): FacilityStatusTone {
  if (status === FacilityStatus.AVAILABLE) {
    return "open";
  }

  if (status === FacilityStatus.APPROVAL_REQUIRED) {
    return "wait";
  }

  return "busy";
}

function getWorkflowStatusLabel(status: string) {
  const labels: Record<string, string> = {
    [WorkflowStatus.DRAFT]: "下書き",
    [WorkflowStatus.PENDING]: "承認待ち",
    [WorkflowStatus.APPROVED]: "予約済み",
    [WorkflowStatus.REJECTED]: "却下",
    [WorkflowStatus.RETURNED]: "差し戻し",
    [WorkflowStatus.CANCELED]: "取消",
  };

  return labels[status] ?? status;
}

export const prismaFacilityRepository = {
  getFacilitySnapshot,
  createFacility,
  updateFacility,
  deleteFacility,
  updateFacilityReservationStatus,
} satisfies FacilityRepository;
