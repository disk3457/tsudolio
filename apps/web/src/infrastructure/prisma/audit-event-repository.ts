import { auditEventExportLimit } from "@/application/audit/audit-query";
import { isAuditLogRetentionDays } from "@/application/audit/audit-retention-validation";
import type {
  AuditEventFilterState,
  AuditEventSummary,
  AuditLogRetentionDays,
} from "@/application/audit/types";
import type { AuditEventRepository } from "@/application/audit/use-cases";
import { ApplicationError } from "@/application/shared/application-error";
import { toMutationContext } from "@/application/security/permissions";
import type {
  CurrentUserContext,
  MutationContext,
} from "@/application/security/types";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";
import { AuditSeverity } from "@generated/prisma/enums";

export type AuditEventInput = {
  tenantId: string;
  context: MutationContext;
  action: string;
  targetType: string;
  targetId?: string | null;
  severity?: AuditSeverity;
  metadata?: Prisma.InputJsonObject;
};

export type AuthAuditEventInput = {
  tenantId: string;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  severity?: AuditSeverity;
  ipAddress?: string | null;
  metadata?: Prisma.InputJsonObject;
};

export function recordAuditEvent(
  tx: Prisma.TransactionClient,
  input: AuditEventInput,
) {
  return tx.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.context.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      severity: input.severity ?? AuditSeverity.INFO,
      ipAddress: input.context.ipAddress ?? null,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
    select: {
      id: true,
    },
  });
}

export function recordAuthAuditEvent(input: AuthAuditEventInput) {
  return prisma.auditEvent.create({
    data: createAuthAuditEventData(input),
    select: {
      id: true,
    },
  });
}

export function recordAuthAuditEventInTransaction(
  tx: Prisma.TransactionClient,
  input: AuthAuditEventInput,
) {
  return tx.auditEvent.create({
    data: createAuthAuditEventData(input),
    select: {
      id: true,
    },
  });
}

export async function getAuditEventSnapshot(
  tenantCode: string,
  filters: AuditEventFilterState,
) {
  const tenant = await getAuditTenantByCode(tenantCode);
  const retentionDays = normalizeAuditLogRetentionDays(
    tenant.auditLogRetentionDays,
  );
  const retainedSince = createAuditRetentionCutoff(retentionDays);
  const where = createAuditEventWhere(tenant.id, filters, retainedSince);
  const retainedWhere = createRetainedAuditEventWhere(
    tenant.id,
    retainedSince,
  );
  const [events, total, actionGroups, targetTypeGroups] =
    await prisma.$transaction([
      prisma.auditEvent.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: filters.limit,
      }),
      prisma.auditEvent.count({
        where,
      }),
      prisma.auditEvent.groupBy({
        by: ["action"],
        where: retainedWhere,
        orderBy: {
          action: "asc",
        },
      }),
      prisma.auditEvent.groupBy({
        by: ["targetType"],
        where: retainedWhere,
        orderBy: {
          targetType: "asc",
        },
      }),
    ]);

  return {
    tenant: {
      code: tenant.code,
      name: tenant.displayName ?? tenant.name,
      timezone: tenant.timezone,
      auditLogRetentionDays: retentionDays,
    },
    events: events.map(toAuditEventSummary),
    total,
    retainedSince: retainedSince.toISOString(),
    filterOptions: {
      actions: actionGroups.map((group) => group.action),
      targetTypes: targetTypeGroups.map((group) => group.targetType),
    },
    filters,
  };
}

export async function getAuditEventExportSnapshot(
  tenantCode: string,
  filters: AuditEventFilterState,
) {
  const exportFilters = {
    ...filters,
    limit: Math.min(filters.limit, auditEventExportLimit),
  };
  const snapshot = await getAuditEventSnapshot(tenantCode, exportFilters);
  const exportedAt = new Date().toISOString();

  return {
    ...snapshot,
    exportLimit: exportFilters.limit,
    exportedAt,
    filename: createAuditExportFilename(snapshot.tenant.code, exportedAt),
    truncated: snapshot.total > snapshot.events.length,
  };
}

export async function getAuditRetentionPolicy(
  currentUser: CurrentUserContext,
) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      id: currentUser.tenantId,
    },
    select: {
      auditLogRetentionDays: true,
      updatedAt: true,
    },
  });

  if (!tenant) {
    throw new ApplicationError(
      "TENANT_NOT_FOUND",
      "テナントが見つかりません。",
      404,
    );
  }

  return buildAuditRetentionPolicy({
    tenantId: currentUser.tenantId,
    retentionDays: normalizeAuditLogRetentionDays(
      tenant.auditLogRetentionDays,
    ),
    updatedAt: tenant.updatedAt,
  });
}

export async function updateAuditRetentionPolicy(input: {
  currentUser: CurrentUserContext;
  ipAddress?: string | null;
  retentionDays: AuditLogRetentionDays;
}) {
  const before = await getAuditRetentionPolicy(input.currentUser);

  if (before.retentionDays === input.retentionDays) {
    return before;
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: {
        id: input.currentUser.tenantId,
      },
      data: {
        auditLogRetentionDays: input.retentionDays,
      },
      select: {
        id: true,
      },
    });

    await recordAuditEvent(tx, {
      tenantId: input.currentUser.tenantId,
      context: toMutationContext(input.currentUser, {
        ipAddress: input.ipAddress ?? null,
      }),
      action: "監査ログ保持設定を更新",
      targetType: "tenant",
      targetId: input.currentUser.tenantId,
      severity: AuditSeverity.NOTICE,
      metadata: {
        auditLogRetentionDaysBefore: before.retentionDays,
        auditLogRetentionDaysAfter: input.retentionDays,
        expiredEventCountBefore: before.expiredEventCount,
      },
    });
  });

  return getAuditRetentionPolicy(input.currentUser);
}

function createAuthAuditEventData(input: AuthAuditEventInput) {
  return {
    tenantId: input.tenantId,
    actorId: input.actorId ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    severity: input.severity ?? AuditSeverity.INFO,
    ipAddress: input.ipAddress ?? null,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

function createAuditEventWhere(
  tenantId: string,
  filters: AuditEventFilterState,
  retainedSince: Date,
) {
  const where: Prisma.AuditEventWhereInput = {
    tenantId,
  };

  if (filters.severity !== "all") {
    where.severity = filters.severity;
  }

  if (filters.action !== "all") {
    where.action = filters.action;
  }

  if (filters.targetType !== "all") {
    where.targetType = filters.targetType;
  }

  const createdAt = getCreatedAtFilter(filters.range, retainedSince);

  if (createdAt) {
    where.createdAt = createdAt;
  }

  if (filters.query) {
    const textFilter = {
      contains: filters.query,
      mode: "insensitive" as const,
    };

    where.OR = [
      { action: textFilter },
      { targetType: textFilter },
      { targetId: textFilter },
      { ipAddress: textFilter },
      {
        actor: {
          is: {
            displayName: textFilter,
          },
        },
      },
      {
        actor: {
          is: {
            email: textFilter,
          },
        },
      },
    ];
  }

  return where;
}

function getCreatedAtFilter(
  range: AuditEventFilterState["range"],
  retainedSince: Date,
) {
  let start = retainedSince;

  if (range !== "all") {
    const rangeStart = new Date();
    const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;

    rangeStart.setDate(rangeStart.getDate() - days);
    start = rangeStart > retainedSince ? rangeStart : retainedSince;
  }

  return {
    gte: start,
  };
}

function createAuditRetentionCutoff(retentionDays: AuditLogRetentionDays) {
  const start = new Date();

  start.setDate(start.getDate() - retentionDays);

  return start;
}

function createRetainedAuditEventWhere(tenantId: string, retainedSince: Date) {
  return {
    tenantId,
    createdAt: {
      gte: retainedSince,
    },
  };
}

async function getAuditTenantByCode(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
    select: {
      id: true,
      auditLogRetentionDays: true,
      code: true,
      displayName: true,
      name: true,
      timezone: true,
    },
  });

  if (!tenant) {
    throw new ApplicationError(
      "TENANT_NOT_FOUND",
      "テナントが見つかりません。",
      404,
    );
  }

  return tenant;
}

async function buildAuditRetentionPolicy({
  retentionDays,
  tenantId,
  updatedAt,
}: {
  retentionDays: AuditLogRetentionDays;
  tenantId: string;
  updatedAt: Date;
}) {
  const retainedSince = createAuditRetentionCutoff(retentionDays);
  const [totalEventCount, retainedEventCount, oldestEvent, newestEvent] =
    await prisma.$transaction([
      prisma.auditEvent.count({
        where: {
          tenantId,
        },
      }),
      prisma.auditEvent.count({
        where: createRetainedAuditEventWhere(tenantId, retainedSince),
      }),
      prisma.auditEvent.findFirst({
        where: {
          tenantId,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.auditEvent.findFirst({
        where: {
          tenantId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

  return {
    retentionDays,
    retainedSince: retainedSince.toISOString(),
    totalEventCount,
    retainedEventCount,
    expiredEventCount: totalEventCount - retainedEventCount,
    oldestEventAt: oldestEvent?.createdAt.toISOString() ?? null,
    newestEventAt: newestEvent?.createdAt.toISOString() ?? null,
    updatedAt: updatedAt.toISOString(),
  };
}

function normalizeAuditLogRetentionDays(value: number): AuditLogRetentionDays {
  if (isAuditLogRetentionDays(value)) {
    return value;
  }

  return 365;
}

function toAuditEventSummary(event: {
  id: string;
  createdAt: Date;
  action: string;
  severity: AuditSeverity;
  targetType: string;
  targetId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  actor: AuditEventSummary["actor"];
}): AuditEventSummary {
  return {
    id: event.id,
    createdAt: event.createdAt.toISOString(),
    action: event.action,
    severity: event.severity,
    targetType: event.targetType,
    targetId: event.targetId,
    ipAddress: event.ipAddress,
    metadata: event.metadata,
    actor: event.actor,
  };
}

function createAuditExportFilename(tenantCode: string, exportedAt: string) {
  const tenant = tenantCode.replaceAll(/[^a-zA-Z0-9_-]/g, "-");
  const timestamp = exportedAt.replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  return `audit-events-${tenant}-${timestamp}.csv`;
}

export const prismaAuditEventRepository = {
  getAuditEventExportSnapshot,
  getAuditEventSnapshot,
  getAuditRetentionPolicy,
  updateAuditRetentionPolicy,
} satisfies AuditEventRepository;
