import type { MutationContext } from "@/application/security/types";
import type { AuditEventFilterState } from "@/application/audit/types";
import type { AuditEventRepository } from "@/application/audit/use-cases";
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
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantCode}`);
  }

  const where = createAuditEventWhere(tenant.id, filters);
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
        where: {
          tenantId: tenant.id,
        },
        orderBy: {
          action: "asc",
        },
      }),
      prisma.auditEvent.groupBy({
        by: ["targetType"],
        where: {
          tenantId: tenant.id,
        },
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
    },
    events: events.map((event) => ({
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      action: event.action,
      severity: event.severity,
      targetType: event.targetType,
      targetId: event.targetId,
      ipAddress: event.ipAddress,
      metadata: event.metadata,
      actor: event.actor,
    })),
    total,
    filterOptions: {
      actions: actionGroups.map((group) => group.action),
      targetTypes: targetTypeGroups.map((group) => group.targetType),
    },
    filters,
  };
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

  const createdAt = getCreatedAtFilter(filters.range);

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

function getCreatedAtFilter(range: AuditEventFilterState["range"]) {
  if (range === "all") {
    return null;
  }

  const start = new Date();
  const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;

  start.setDate(start.getDate() - days);

  return {
    gte: start,
  };
}

export const prismaAuditEventRepository = {
  getAuditEventSnapshot,
} satisfies AuditEventRepository;
