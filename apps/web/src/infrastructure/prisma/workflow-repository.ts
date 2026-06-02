import { hasPermission } from "@/application/security/permissions";
import type {
  CurrentUserContext,
  MutationContext,
} from "@/application/security/types";
import { WorkflowApplicationError } from "@/application/workflows/errors";
import type { WorkflowRepository } from "@/application/workflows/use-cases";
import type {
  WorkflowDecisionInput,
  WorkflowPriorityValue,
  WorkflowRequestSummary,
  WorkflowSnapshot,
  WorkflowStatusTone,
  WorkflowStatusValue,
} from "@/application/workflows/types";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";
import {
  AuditSeverity,
  WorkflowPriority,
  WorkflowStatus,
} from "@generated/prisma/enums";

export async function getWorkflowSnapshot(
  currentUser: CurrentUserContext,
): Promise<WorkflowSnapshot> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [pendingRequests, recentRequests, pending, overdue, highPriority, decidedToday] =
    await Promise.all([
      findPendingRequests(currentUser.tenantId),
      findRecentRequests(currentUser.tenantId),
      prisma.workflowRequest.count({
        where: {
          tenantId: currentUser.tenantId,
          status: WorkflowStatus.PENDING,
        },
      }),
      prisma.workflowRequest.count({
        where: {
          tenantId: currentUser.tenantId,
          status: WorkflowStatus.PENDING,
          dueAt: {
            lt: now,
          },
        },
      }),
      prisma.workflowRequest.count({
        where: {
          tenantId: currentUser.tenantId,
          status: WorkflowStatus.PENDING,
          priority: {
            in: [WorkflowPriority.HIGH, WorkflowPriority.URGENT],
          },
        },
      }),
      prisma.workflowRequest.count({
        where: {
          tenantId: currentUser.tenantId,
          status: {
            in: [
              WorkflowStatus.APPROVED,
              WorkflowStatus.REJECTED,
              WorkflowStatus.RETURNED,
            ],
          },
          decidedAt: {
            gte: todayStart,
          },
        },
      }),
    ]);

  return {
    tenant: {
      code: currentUser.tenantCode,
      name: currentUser.tenantName,
      timezone: "Asia/Tokyo",
    },
    canApprove: hasPermission(currentUser, "workflow.approve"),
    pendingRequests: pendingRequests.map((request) => mapWorkflowRequest(request, now)),
    recentRequests: recentRequests.map((request) => mapWorkflowRequest(request, now)),
    stats: {
      pending,
      overdue,
      highPriority,
      decidedToday,
    },
  };
}

export async function updateWorkflowRequestStatus(
  requestId: string,
  input: WorkflowDecisionInput,
  context: MutationContext,
): Promise<WorkflowRequestSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);
  const now = new Date();

  const updatedRequestId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);

    const existingRequest = await tx.workflowRequest.findFirst({
      where: {
        id: requestId,
        tenantId: tenant.id,
      },
      include: {
        organizationUnit: true,
        requester: true,
      },
    });

    if (!existingRequest) {
      throw new WorkflowApplicationError(
        "WORKFLOW_REQUEST_NOT_FOUND",
        "指定された申請が見つかりません。",
        404,
      );
    }

    if (existingRequest.status !== WorkflowStatus.PENDING) {
      throw new WorkflowApplicationError(
        "INVALID_WORKFLOW_REQUEST_STATE",
        "承認待ちの申請だけを決裁できます。",
        409,
      );
    }

    await tx.workflowRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status: input.status,
        decidedAt: now,
      },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: getWorkflowDecisionAction(input.status),
      targetType: "workflow_request",
      targetId: requestId,
      severity:
        input.status === WorkflowStatus.APPROVED
          ? AuditSeverity.NOTICE
          : AuditSeverity.WARNING,
      metadata: {
        title: existingRequest.title,
        category: existingRequest.category,
        requesterId: existingRequest.requesterId,
        requesterName: existingRequest.requester.displayName,
        organizationUnitId: existingRequest.organizationUnitId,
        organizationUnitName: existingRequest.organizationUnit?.name ?? null,
        beforeStatus: existingRequest.status,
        afterStatus: input.status,
        dueAt: existingRequest.dueAt?.toISOString() ?? null,
        submittedAt: existingRequest.submittedAt?.toISOString() ?? null,
      },
    });

    return requestId;
  });

  return getWorkflowRequestSummary(tenant.id, updatedRequestId, now);
}

async function getTenantOrThrow(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new WorkflowApplicationError(
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
    throw new WorkflowApplicationError(
      "ACTOR_NOT_FOUND",
      "申請を決裁する利用者が見つかりません。",
      404,
    );
  }
}

function findPendingRequests(tenantId: string) {
  return prisma.workflowRequest.findMany({
    where: {
      tenantId,
      status: WorkflowStatus.PENDING,
    },
    include: {
      organizationUnit: true,
      requester: true,
    },
    orderBy: [
      {
        priority: "desc",
      },
      {
        dueAt: "asc",
      },
      {
        submittedAt: "asc",
      },
    ],
    take: 24,
  });
}

function findRecentRequests(tenantId: string) {
  return prisma.workflowRequest.findMany({
    where: {
      tenantId,
      status: {
        in: [
          WorkflowStatus.APPROVED,
          WorkflowStatus.REJECTED,
          WorkflowStatus.RETURNED,
          WorkflowStatus.CANCELED,
        ],
      },
    },
    include: {
      organizationUnit: true,
      requester: true,
    },
    orderBy: [
      {
        decidedAt: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
    take: 12,
  });
}

type WorkflowRequestRecord = Awaited<ReturnType<typeof findPendingRequests>>[number];

async function getWorkflowRequestSummary(
  tenantId: string,
  requestId: string,
  now: Date,
) {
  const request = await prisma.workflowRequest.findFirst({
    where: {
      id: requestId,
      tenantId,
    },
    include: {
      organizationUnit: true,
      requester: true,
    },
  });

  if (!request) {
    throw new WorkflowApplicationError(
      "WORKFLOW_REQUEST_NOT_FOUND",
      "指定された申請が見つかりません。",
      404,
    );
  }

  return mapWorkflowRequest(request, now);
}

function mapWorkflowRequest(
  request: WorkflowRequestRecord,
  now: Date,
): WorkflowRequestSummary {
  return {
    id: request.id,
    title: request.title,
    category: request.category,
    status: request.status as WorkflowStatusValue,
    statusLabel: getWorkflowStatusLabel(request.status),
    tone: getWorkflowStatusTone(request.status),
    priority: request.priority as WorkflowPriorityValue,
    priorityLabel: getWorkflowPriorityLabel(request.priority),
    requester: {
      id: request.requester.id,
      name: request.requester.displayName,
    },
    organizationUnit: request.organizationUnit
      ? {
          id: request.organizationUnit.id,
          name: request.organizationUnit.name,
        }
      : null,
    dueAt: request.dueAt?.toISOString() ?? null,
    submittedAt: request.submittedAt?.toISOString() ?? null,
    decidedAt: request.decidedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    isOverdue:
      request.status === WorkflowStatus.PENDING &&
      request.dueAt !== null &&
      request.dueAt < now,
  };
}

function getWorkflowDecisionAction(status: WorkflowDecisionInput["status"]) {
  const labels: Record<WorkflowDecisionInput["status"], string> = {
    [WorkflowStatus.APPROVED]: "申請を承認",
    [WorkflowStatus.REJECTED]: "申請を却下",
    [WorkflowStatus.RETURNED]: "申請を差し戻し",
  };

  return labels[status];
}

function getWorkflowStatusLabel(status: string) {
  const labels: Record<string, string> = {
    [WorkflowStatus.DRAFT]: "下書き",
    [WorkflowStatus.PENDING]: "承認待ち",
    [WorkflowStatus.APPROVED]: "承認済み",
    [WorkflowStatus.REJECTED]: "却下",
    [WorkflowStatus.RETURNED]: "差し戻し",
    [WorkflowStatus.CANCELED]: "取消",
  };

  return labels[status] ?? status;
}

function getWorkflowStatusTone(status: string): WorkflowStatusTone {
  if (status === WorkflowStatus.APPROVED) {
    return "done";
  }

  if (status === WorkflowStatus.PENDING) {
    return "wait";
  }

  if (status === WorkflowStatus.RETURNED) {
    return "returned";
  }

  if (status === WorkflowStatus.DRAFT) {
    return "draft";
  }

  return "danger";
}

function getWorkflowPriorityLabel(priority: string) {
  const labels: Record<string, string> = {
    [WorkflowPriority.LOW]: "低",
    [WorkflowPriority.NORMAL]: "通常",
    [WorkflowPriority.HIGH]: "高",
    [WorkflowPriority.URGENT]: "緊急",
  };

  return labels[priority] ?? priority;
}

export const prismaWorkflowRepository = {
  getWorkflowSnapshot,
  updateWorkflowRequestStatus,
} satisfies WorkflowRepository;
