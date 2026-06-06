import type { OperationsRepository } from "@/application/operations/use-cases";
import type {
  OperationHealthCheck,
  OperationMetric,
  OperationsBackupSnapshot,
  OperationsSnapshot,
  TenantProfile,
  TenantProfileInput,
  TenantTypeValue,
} from "@/application/operations/types";
import { ApplicationError } from "@/application/shared/application-error";
import type {
  CurrentUserContext,
  MutationContext,
} from "@/application/security/types";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import {
  AuditSeverity,
  DocumentStatus,
  FacilityStatus,
  MembershipStatus,
  WorkflowStatus,
  type TenantType,
} from "@generated/prisma/enums";

const backupEndpoint = "/api/operations/export";
const backupIncludes = [
  "テナント設定",
  "組織・利用者・権限",
  "予定・施設予約",
  "掲示・回覧",
  "申請・承認",
  "文書台帳・版履歴",
];

export async function getOperationsSnapshot(
  currentUser: CurrentUserContext,
): Promise<OperationsSnapshot> {
  return buildOperationsSnapshot(currentUser.tenantCode);
}

export async function updateTenantProfile(
  input: TenantProfileInput,
  context: MutationContext,
): Promise<OperationsSnapshot> {
  const tenant = await getTenantByCodeOrThrow(context.tenantCode);
  const before = mapTenantProfile(tenant);
  const hasChanges =
    before.name !== input.name ||
    before.displayName !== input.displayName ||
    before.type !== input.type ||
    before.timezone !== input.timezone;

  if (hasChanges) {
    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: {
          id: tenant.id,
        },
        data: {
          displayName: input.displayName,
          name: input.name,
          timezone: input.timezone,
          type: input.type as TenantType,
        },
        select: {
          id: true,
        },
      });

      await recordAuditEvent(tx, {
        tenantId: tenant.id,
        context,
        action: "テナント基本情報を更新",
        targetType: "tenant",
        targetId: tenant.id,
        severity: AuditSeverity.NOTICE,
        metadata: {
          before: {
            displayName: before.displayName,
            name: before.name,
            timezone: before.timezone,
            type: before.type,
          },
          after: {
            displayName: input.displayName,
            name: input.name,
            timezone: input.timezone,
            type: input.type,
          },
        },
      });
    });
  }

  return buildOperationsSnapshot(context.tenantCode);
}

export async function getOperationsBackupSnapshot(
  currentUser: CurrentUserContext,
): Promise<OperationsBackupSnapshot> {
  const tenant = await getTenantByCodeOrThrow(currentUser.tenantCode);
  const [
    organizationUnits,
    users,
    memberships,
    roles,
    permissions,
    rolePermissions,
    roleAssignments,
    facilities,
    calendarEvents,
    facilityReservations,
    notices,
    noticeAcknowledgements,
    workflowRequests,
    documents,
    documentVersions,
  ] = await prisma.$transaction([
    prisma.organizationUnit.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { tenantId: tenant.id },
      orderBy: { displayName: "asc" },
    }),
    prisma.membership.findMany({
      where: { tenantId: tenant.id },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.role.findMany({
      where: { tenantId: tenant.id },
      orderBy: { code: "asc" },
    }),
    prisma.permission.findMany({
      where: {
        roles: {
          some: {
            role: {
              tenantId: tenant.id,
            },
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.rolePermission.findMany({
      where: {
        role: {
          tenantId: tenant.id,
        },
      },
      orderBy: [{ roleId: "asc" }, { permissionId: "asc" }],
    }),
    prisma.roleAssignment.findMany({
      where: {
        role: {
          tenantId: tenant.id,
        },
      },
      orderBy: { assignedAt: "asc" },
    }),
    prisma.facility.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { tenantId: tenant.id },
      orderBy: { startsAt: "asc" },
    }),
    prisma.facilityReservation.findMany({
      where: { tenantId: tenant.id },
      orderBy: { startsAt: "asc" },
    }),
    prisma.notice.findMany({
      where: { tenantId: tenant.id },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.noticeAcknowledgement.findMany({
      where: { tenantId: tenant.id },
      orderBy: { acknowledgedAt: "desc" },
    }),
    prisma.workflowRequest.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.documentVersion.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const data = {
    organizationUnits,
    users,
    memberships,
    roles,
    permissions,
    rolePermissions,
    roleAssignments,
    facilities,
    calendarEvents,
    facilityReservations,
    notices,
    noticeAcknowledgements,
    workflowRequests,
    documents,
    documentVersions,
  };

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    tenant: mapTenantProfile(tenant),
    counts: Object.fromEntries(
      Object.entries(data).map(([key, rows]) => [key, rows.length]),
    ),
    data,
  };
}

async function buildOperationsSnapshot(
  tenantCode: string,
): Promise<OperationsSnapshot> {
  const tenant = await getTenantByCodeOrThrow(tenantCode);
  const now = new Date();
  const last24Hours = new Date(now);
  last24Hours.setDate(now.getDate() - 1);
  const next30Days = new Date(now);
  next30Days.setDate(now.getDate() + 30);
  const retainedSince = new Date(now);
  retainedSince.setDate(now.getDate() - tenant.auditLogRetentionDays);

  const [
    organizationUnitCount,
    userCount,
    membershipCount,
    activeMembershipCount,
    roleCount,
    permissionCount,
    rolePermissionCount,
    roleAssignmentCount,
    facilityCount,
    availableFacilityCount,
    calendarEventCount,
    upcomingEventCount,
    facilityReservationCount,
    noticeCount,
    activeNoticeCount,
    noticeAcknowledgementCount,
    unreadNotificationCount,
    workflowTotalCount,
    workflowPendingCount,
    workflowDraftCount,
    documentCount,
    activeDocumentCount,
    documentVersionCount,
    auditEventCount,
    retainedAuditEventCount,
    criticalSecurityEventCount,
    warningSecurityEventCount,
    recentEvents,
  ] = await prisma.$transaction([
    prisma.organizationUnit.count({ where: { tenantId: tenant.id } }),
    prisma.user.count({ where: { tenantId: tenant.id } }),
    prisma.membership.count({ where: { tenantId: tenant.id } }),
    prisma.membership.count({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
    }),
    prisma.role.count({ where: { tenantId: tenant.id } }),
    prisma.permission.count({
      where: {
        roles: {
          some: {
            role: {
              tenantId: tenant.id,
            },
          },
        },
      },
    }),
    prisma.rolePermission.count({
      where: {
        role: {
          tenantId: tenant.id,
        },
      },
    }),
    prisma.roleAssignment.count({
      where: {
        role: {
          tenantId: tenant.id,
        },
      },
    }),
    prisma.facility.count({ where: { tenantId: tenant.id } }),
    prisma.facility.count({
      where: { tenantId: tenant.id, status: FacilityStatus.AVAILABLE },
    }),
    prisma.calendarEvent.count({ where: { tenantId: tenant.id } }),
    prisma.calendarEvent.count({
      where: {
        tenantId: tenant.id,
        startsAt: {
          gte: now,
          lt: next30Days,
        },
      },
    }),
    prisma.facilityReservation.count({ where: { tenantId: tenant.id } }),
    prisma.notice.count({ where: { tenantId: tenant.id } }),
    prisma.notice.count({
      where: {
        tenantId: tenant.id,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
    }),
    prisma.noticeAcknowledgement.count({ where: { tenantId: tenant.id } }),
    prisma.notification.count({
      where: { tenantId: tenant.id, readAt: null },
    }),
    prisma.workflowRequest.count({ where: { tenantId: tenant.id } }),
    prisma.workflowRequest.count({
      where: { tenantId: tenant.id, status: WorkflowStatus.PENDING },
    }),
    prisma.workflowRequest.count({
      where: { tenantId: tenant.id, status: WorkflowStatus.DRAFT },
    }),
    prisma.document.count({ where: { tenantId: tenant.id } }),
    prisma.document.count({
      where: { tenantId: tenant.id, status: DocumentStatus.ACTIVE },
    }),
    prisma.documentVersion.count({ where: { tenantId: tenant.id } }),
    prisma.auditEvent.count({ where: { tenantId: tenant.id } }),
    prisma.auditEvent.count({
      where: {
        tenantId: tenant.id,
        createdAt: {
          gte: retainedSince,
        },
      },
    }),
    prisma.auditEvent.count({
      where: {
        tenantId: tenant.id,
        createdAt: {
          gte: last24Hours,
        },
        severity: AuditSeverity.CRITICAL,
      },
    }),
    prisma.auditEvent.count({
      where: {
        tenantId: tenant.id,
        createdAt: {
          gte: last24Hours,
        },
        severity: AuditSeverity.WARNING,
      },
    }),
    prisma.auditEvent.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { targetType: "tenant" },
          { action: { contains: "設定" } },
          { action: { contains: "管理" } },
        ],
      },
      include: {
        actor: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
    }),
  ]);
  const backupRecordCount =
    organizationUnitCount +
    userCount +
    membershipCount +
    roleCount +
    permissionCount +
    rolePermissionCount +
    roleAssignmentCount +
    facilityCount +
    calendarEventCount +
    facilityReservationCount +
    noticeCount +
    noticeAcknowledgementCount +
    workflowTotalCount +
    documentCount +
    documentVersionCount;

  return {
    tenant: mapTenantProfile(tenant),
    metrics: buildMetrics({
      activeDocumentCount,
      activeMembershipCount,
      activeNoticeCount,
      auditEventCount,
      availableFacilityCount,
      documentVersionCount,
      facilityCount,
      organizationUnitCount,
      retainedAuditEventCount,
      roleAssignmentCount,
      roleCount,
      upcomingEventCount,
      unreadNotificationCount,
      userCount,
      workflowDraftCount,
      workflowPendingCount,
      workflowTotalCount,
    }),
    healthChecks: buildHealthChecks({
      backupRecordCount,
      checkedAt: now.toISOString(),
      criticalSecurityEventCount,
      pendingWorkflowCount: workflowPendingCount,
      requirePasskeyForPrivilegedUsers:
        tenant.requirePasskeyForPrivilegedUsers,
      retentionDays: tenant.auditLogRetentionDays,
      warningSecurityEventCount,
    }),
    backup: {
      endpoint: backupEndpoint,
      estimatedRecordCount: backupRecordCount,
      filename: createBackupFilename(tenant.code, now),
      generatedAt: now.toISOString(),
      includes: backupIncludes,
    },
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      action: event.action,
      actor: event.actor?.displayName ?? null,
      createdAt: event.createdAt.toISOString(),
      severity: event.severity,
      targetId: event.targetId,
      targetType: event.targetType,
    })),
  };
}

function buildMetrics(input: {
  activeDocumentCount: number;
  activeMembershipCount: number;
  activeNoticeCount: number;
  auditEventCount: number;
  availableFacilityCount: number;
  documentVersionCount: number;
  facilityCount: number;
  organizationUnitCount: number;
  retainedAuditEventCount: number;
  roleAssignmentCount: number;
  roleCount: number;
  upcomingEventCount: number;
  unreadNotificationCount: number;
  userCount: number;
  workflowDraftCount: number;
  workflowPendingCount: number;
  workflowTotalCount: number;
}): OperationMetric[] {
  return [
    {
      key: "identity",
      label: "利用者",
      value: input.activeMembershipCount,
      unit: "所属",
      detail: `${input.userCount}人 / ${input.organizationUnitCount}組織`,
      tone: "neutral",
    },
    {
      key: "permissions",
      label: "権限割当",
      value: input.roleAssignmentCount,
      unit: "件",
      detail: `${input.roleCount}ロールを運用中`,
      tone: "good",
    },
    {
      key: "facilities",
      label: "施設",
      value: input.availableFacilityCount,
      unit: "利用可",
      detail: `${input.facilityCount}施設を登録`,
      tone: input.availableFacilityCount > 0 ? "good" : "warning",
    },
    {
      key: "workflow",
      label: "承認待ち",
      value: input.workflowPendingCount,
      unit: "件",
      detail: `${input.workflowTotalCount}申請 / 下書き${input.workflowDraftCount}件`,
      tone: input.workflowPendingCount > 10 ? "warning" : "neutral",
    },
    {
      key: "content",
      label: "運用コンテンツ",
      value: input.activeNoticeCount + input.activeDocumentCount,
      unit: "件",
      detail: `掲示${input.activeNoticeCount}件 / 文書${input.activeDocumentCount}件`,
      tone: "neutral",
    },
    {
      key: "audit",
      label: "監査ログ",
      value: input.retainedAuditEventCount,
      unit: "件",
      detail: `総数${input.auditEventCount}件 / 版履歴${input.documentVersionCount}件`,
      tone: "good",
    },
    {
      key: "schedule",
      label: "今後30日",
      value: input.upcomingEventCount,
      unit: "予定",
      detail: "予定・施設予約の稼働量",
      tone: "neutral",
    },
  ];
}

function buildHealthChecks(input: {
  backupRecordCount: number;
  checkedAt: string;
  criticalSecurityEventCount: number;
  pendingWorkflowCount: number;
  requirePasskeyForPrivilegedUsers: boolean;
  retentionDays: number;
  warningSecurityEventCount: number;
}): OperationHealthCheck[] {
  const securityStatus =
    input.criticalSecurityEventCount > 0
      ? "CRITICAL"
      : input.warningSecurityEventCount > 0
        ? "WARNING"
        : "OK";

  return [
    {
      key: "database",
      label: "データベース",
      status: "OK",
      value: "接続済み",
      detail: "Prismaクエリと集計を取得済み",
      checkedAt: input.checkedAt,
    },
    {
      key: "backup",
      label: "バックアップ",
      status: input.backupRecordCount > 0 ? "OK" : "WARNING",
      value: `${input.backupRecordCount}レコード`,
      detail: "運用エクスポート対象の概算",
      checkedAt: input.checkedAt,
    },
    {
      key: "auth",
      label: "高権限認証",
      status: input.requirePasskeyForPrivilegedUsers ? "OK" : "WARNING",
      value: input.requirePasskeyForPrivilegedUsers ? "Passkey必須" : "任意",
      detail: "テナントの認証ポリシー",
      checkedAt: input.checkedAt,
    },
    {
      key: "audit-retention",
      label: "監査保持",
      status: input.retentionDays >= 365 ? "OK" : "WARNING",
      value: `${input.retentionDays}日`,
      detail: "監査ログ保持期間",
      checkedAt: input.checkedAt,
    },
    {
      key: "security-events",
      label: "重大イベント",
      status: securityStatus,
      value:
        input.criticalSecurityEventCount > 0
          ? `${input.criticalSecurityEventCount}件`
          : `${input.warningSecurityEventCount}件`,
      detail: "直近24時間の警告以上の監査イベント",
      checkedAt: input.checkedAt,
    },
    {
      key: "workflow-backlog",
      label: "承認滞留",
      status: input.pendingWorkflowCount > 10 ? "WARNING" : "OK",
      value: `${input.pendingWorkflowCount}件`,
      detail: "承認待ち申請の件数",
      checkedAt: input.checkedAt,
    },
  ];
}

async function getTenantByCodeOrThrow(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
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

function mapTenantProfile(tenant: {
  auditLogRetentionDays: number;
  code: string;
  createdAt: Date;
  displayName: string | null;
  name: string;
  requirePasskeyForPrivilegedUsers: boolean;
  timezone: string;
  type: string;
  updatedAt: Date;
}): TenantProfile {
  return {
    auditLogRetentionDays: tenant.auditLogRetentionDays,
    code: tenant.code,
    createdAt: tenant.createdAt.toISOString(),
    displayName: tenant.displayName,
    name: tenant.name,
    requirePasskeyForPrivilegedUsers:
      tenant.requirePasskeyForPrivilegedUsers,
    timezone: tenant.timezone,
    type: tenant.type as TenantTypeValue,
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

function createBackupFilename(tenantCode: string, date: Date) {
  const dateStamp = date.toISOString().slice(0, 10).replaceAll("-", "");

  return `${tenantCode}-operations-${dateStamp}.json`;
}

export const prismaOperationsRepository = {
  getOperationsBackupSnapshot,
  getOperationsSnapshot,
  updateTenantProfile,
} satisfies OperationsRepository;
