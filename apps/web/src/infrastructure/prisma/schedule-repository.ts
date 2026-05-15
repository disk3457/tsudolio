import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { ScheduleRepository } from "@/application/schedule/use-cases";
import type {
  FacilityScheduleSummary,
  ScheduleEventInput,
  ScheduleEventSummary,
  ScheduleRange,
  ScheduleSnapshot,
} from "@/application/schedule/types";
import type { MutationContext } from "@/application/security/types";
import { ScheduleApplicationError } from "@/application/schedule/errors";
import { reservationWorkflowStatusForFacility } from "@/domain/schedule/facility-reservation";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import type { Prisma } from "@generated/prisma/client";
import {
  AuditSeverity,
  FacilityStatus,
  WorkflowStatus,
} from "@generated/prisma/enums";

export async function getScheduleSnapshot(
  range: ScheduleRange,
  tenantCode: string,
): Promise<ScheduleSnapshot> {
  const tenant = await getTenantOrThrow(tenantCode);
  const { rangeStart, rangeEnd } = getRangeWindow(range);
  const now = new Date();

  const [events, facilities, organizationUnits, users] = await Promise.all([
    findScheduleEvents(tenant.id, rangeStart, rangeEnd),
    findFacilities(tenant.id, now),
    prisma.organizationUnit.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.user.findMany({
      where: { tenantId: tenant.id },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
      },
    }),
  ]);

  return {
    tenant: {
      code: tenant.code,
      name: tenant.displayName ?? tenant.name,
      timezone: tenant.timezone,
    },
    range,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    events: events.map(mapScheduleEvent),
    facilities: facilities.map(mapFacility),
    organizationUnits,
    users: users.map((user) => ({
      id: user.id,
      name: user.displayName,
    })),
  };
}

export async function createScheduleEvent(
  input: ScheduleEventInput,
  context: MutationContext,
): Promise<ScheduleEventSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  const eventId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );

    const facility = input.facilityId
      ? await tx.facility.findFirst({
          where: {
            id: input.facilityId,
            tenantId: tenant.id,
          },
          select: {
            id: true,
            status: true,
          },
        })
      : null;

    if (input.facilityId && !facility) {
      throw new ScheduleApplicationError(
        "FACILITY_NOT_FOUND",
        "指定された施設が見つかりません。",
        404,
      );
    }

    if (facility) {
      await assertFacilityReservationIsOpen(tx, {
        tenantId: tenant.id,
        facilityId: facility.id,
        startsAt,
        endsAt,
      });
    }

    const event = await tx.calendarEvent.create({
      data: {
        tenantId: tenant.id,
        organizationUnitId: input.organizationUnitId,
        createdById: context.actorUserId,
        title: input.title,
        description: input.description,
        startsAt,
        endsAt,
        location: input.location,
        visibility: input.visibility,
      },
      select: {
        id: true,
      },
    });

    if (facility) {
      await tx.facilityReservation.create({
        data: {
          tenantId: tenant.id,
          facilityId: facility.id,
          eventId: event.id,
          startsAt,
          endsAt,
          purpose: input.title,
          status: getReservationStatusForFacility(facility.status),
        },
      });
    }

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "予定を作成",
      targetType: "calendar_event",
      targetId: event.id,
      severity: AuditSeverity.NOTICE,
      metadata: {
        title: input.title,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        organizationUnitId: input.organizationUnitId,
        facilityId: input.facilityId,
      },
    });

    return event.id;
  });

  return getScheduleEventSummary(tenant.id, eventId);
}

export async function updateScheduleEvent(
  eventId: string,
  input: ScheduleEventInput,
  context: MutationContext,
): Promise<ScheduleEventSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  const updatedEventId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    const existingEvent = await tx.calendarEvent.findFirst({
      where: {
        id: eventId,
        tenantId: tenant.id,
      },
      include: {
        reservation: true,
      },
    });

    if (!existingEvent) {
      throw new ScheduleApplicationError(
        "EVENT_NOT_FOUND",
        "指定された予定が見つかりません。",
        404,
      );
    }

    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );

    const facility = input.facilityId
      ? await tx.facility.findFirst({
          where: {
            id: input.facilityId,
            tenantId: tenant.id,
          },
          select: {
            id: true,
            status: true,
          },
        })
      : null;

    if (input.facilityId && !facility) {
      throw new ScheduleApplicationError(
        "FACILITY_NOT_FOUND",
        "指定された施設が見つかりません。",
        404,
      );
    }

    if (facility) {
      await assertFacilityReservationIsOpen(tx, {
        tenantId: tenant.id,
        facilityId: facility.id,
        startsAt,
        endsAt,
        excludingReservationId: existingEvent.reservation?.id ?? null,
      });
    }

    await tx.calendarEvent.update({
      where: { id: eventId },
      data: {
        organizationUnitId: input.organizationUnitId,
        title: input.title,
        description: input.description,
        startsAt,
        endsAt,
        location: input.location,
        visibility: input.visibility,
      },
    });

    if (!facility) {
      await tx.facilityReservation.deleteMany({
        where: {
          tenantId: tenant.id,
          eventId,
        },
      });
    } else {
      const reservationData = {
        tenantId: tenant.id,
        facilityId: facility.id,
        eventId,
        startsAt,
        endsAt,
        purpose: input.title,
        status: getReservationStatusForFacility(facility.status),
      };

      if (existingEvent.reservation) {
        await tx.facilityReservation.update({
          where: { id: existingEvent.reservation.id },
          data: reservationData,
        });
      } else {
        await tx.facilityReservation.create({
          data: reservationData,
        });
      }
    }

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "予定を更新",
      targetType: "calendar_event",
      targetId: eventId,
      severity: AuditSeverity.NOTICE,
      metadata: {
        title: input.title,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        organizationUnitId: input.organizationUnitId,
        facilityId: input.facilityId,
      },
    });

    return eventId;
  });

  return getScheduleEventSummary(tenant.id, updatedEventId);
}

export async function deleteScheduleEvent(
  eventId: string,
  context: MutationContext,
) {
  const tenant = await getTenantOrThrow(context.tenantCode);

  await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    const existingEvent = await tx.calendarEvent.findFirst({
      where: {
        id: eventId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        organizationUnitId: true,
        reservation: {
          select: {
            facilityId: true,
          },
        },
      },
    });

    if (!existingEvent) {
      throw new ScheduleApplicationError(
        "EVENT_NOT_FOUND",
        "指定された予定が見つかりません。",
        404,
      );
    }

    await tx.facilityReservation.deleteMany({
      where: {
        tenantId: tenant.id,
        eventId,
      },
    });

    await tx.calendarEvent.delete({
      where: { id: eventId },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "予定を削除",
      targetType: "calendar_event",
      targetId: eventId,
      severity: AuditSeverity.WARNING,
      metadata: {
        title: existingEvent.title,
        startsAt: existingEvent.startsAt.toISOString(),
        endsAt: existingEvent.endsAt.toISOString(),
        organizationUnitId: existingEvent.organizationUnitId,
        facilityId: existingEvent.reservation?.facilityId ?? null,
      },
    });
  });
}

function getRangeWindow(range: ScheduleRange) {
  const rangeStart = startOfDay(new Date());
  const rangeEnd = new Date(rangeStart);

  if (range === "today") {
    rangeEnd.setDate(rangeEnd.getDate() + 1);
  } else if (range === "week") {
    rangeEnd.setDate(rangeEnd.getDate() + 7);
  } else {
    rangeEnd.setDate(rangeEnd.getDate() + 31);
  }

  return {
    rangeStart,
    rangeEnd,
  };
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

async function getTenantOrThrow(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new ScheduleApplicationError(
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
    throw new ScheduleApplicationError(
      "ACTOR_NOT_FOUND",
      "予定を操作する利用者が見つかりません。",
      404,
    );
  }
}

async function findScheduleEvents(
  tenantId: string,
  rangeStart: Date,
  rangeEnd: Date,
) {
  return prisma.calendarEvent.findMany({
    where: {
      tenantId,
      startsAt: {
        lt: rangeEnd,
      },
      endsAt: {
        gt: rangeStart,
      },
    },
    include: {
      organizationUnit: true,
      createdBy: true,
      reservation: {
        include: {
          facility: true,
        },
      },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
  });
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
          startsAt: {
            gte: now,
          },
          status: {
            in: [WorkflowStatus.PENDING, WorkflowStatus.APPROVED],
          },
        },
        orderBy: {
          startsAt: "asc",
        },
        take: 1,
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

type ScheduleEventRecord = Awaited<ReturnType<typeof findScheduleEvents>>[number];
type FacilityRecord = Awaited<ReturnType<typeof findFacilities>>[number];

async function getScheduleEventSummary(
  tenantId: string,
  eventId: string,
): Promise<ScheduleEventSummary> {
  const event = await prisma.calendarEvent.findFirst({
    where: {
      id: eventId,
      tenantId,
    },
    include: {
      organizationUnit: true,
      createdBy: true,
      reservation: {
        include: {
          facility: true,
        },
      },
    },
  });

  if (!event) {
    throw new ScheduleApplicationError(
      "EVENT_NOT_FOUND",
      "指定された予定が見つかりません。",
      404,
    );
  }

  return mapScheduleEvent(event);
}

function mapScheduleEvent(event: ScheduleEventRecord): ScheduleEventSummary {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    location: event.location,
    visibility: event.visibility,
    organizationUnit: event.organizationUnit
      ? {
          id: event.organizationUnit.id,
          name: event.organizationUnit.name,
        }
      : null,
    createdBy: {
      id: event.createdBy.id,
      name: event.createdBy.displayName,
    },
    reservation: event.reservation
      ? {
          id: event.reservation.id,
          status: event.reservation.status,
          statusLabel: getWorkflowStatusLabel(event.reservation.status),
          facility: {
            id: event.reservation.facility.id,
            name: event.reservation.facility.name,
            status: event.reservation.facility.status,
            capacity: event.reservation.facility.capacity,
            location: event.reservation.facility.location,
          },
        }
      : null,
  };
}

function mapFacility(facility: FacilityRecord): FacilityScheduleSummary {
  const nextReservation = facility.reservations[0] ?? null;

  return {
    id: facility.id,
    name: facility.name,
    status: facility.status,
    statusLabel: getFacilityStatusLabel(facility.status),
    tone: getFacilityTone(facility.status),
    capacity: facility.capacity,
    location: facility.location,
    organizationUnitName: facility.organizationUnit?.name ?? null,
    nextReservation: nextReservation
      ? {
          startsAt: nextReservation.startsAt.toISOString(),
          endsAt: nextReservation.endsAt.toISOString(),
          purpose: nextReservation.purpose,
          status: nextReservation.status,
          statusLabel: getWorkflowStatusLabel(nextReservation.status),
        }
      : null,
  };
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
    throw new ScheduleApplicationError(
      "ORGANIZATION_UNIT_NOT_FOUND",
      "指定された組織が見つかりません。",
      404,
    );
  }
}

async function assertFacilityReservationIsOpen(
  tx: Prisma.TransactionClient,
  {
    tenantId,
    facilityId,
    startsAt,
    endsAt,
    excludingReservationId = null,
  }: {
    tenantId: string;
    facilityId: string;
    startsAt: Date;
    endsAt: Date;
    excludingReservationId?: string | null;
  },
) {
  const conflict = await tx.facilityReservation.findFirst({
    where: {
      tenantId,
      facilityId,
      status: {
        in: [WorkflowStatus.PENDING, WorkflowStatus.APPROVED],
      },
      startsAt: {
        lt: endsAt,
      },
      endsAt: {
        gt: startsAt,
      },
      ...(excludingReservationId
        ? {
            NOT: {
              id: excludingReservationId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (conflict) {
    throw new ScheduleApplicationError(
      "RESERVATION_CONFLICT",
      "指定した時間帯はすでに施設予約があります。",
      409,
    );
  }
}

function getReservationStatusForFacility(status: string) {
  return reservationWorkflowStatusForFacility(status) === "PENDING"
    ? WorkflowStatus.PENDING
    : WorkflowStatus.APPROVED;
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

function getFacilityTone(status: string): FacilityScheduleSummary["tone"] {
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

export const prismaScheduleRepository = {
  getScheduleSnapshot,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
} satisfies ScheduleRepository;
