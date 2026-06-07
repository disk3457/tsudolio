import type {
  OperationHealthCheck,
  OperationMetric,
  OperationsSnapshot,
} from "@/application/operations/types";
import type { CurrentUserContext } from "@/application/security/types";
import {
  backupEndpoint,
  backupIncludes,
  privilegedPermissionCodes,
} from "@/infrastructure/prisma/operations/constants";
import { buildHardeningChecklist } from "@/infrastructure/prisma/operations/hardening";
import {
  getTenantByCodeOrThrow,
  mapTenantProfile,
} from "@/infrastructure/prisma/operations/tenant";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import {
  AuditSeverity,
  DocumentStatus,
  FacilityStatus,
  MembershipStatus,
  WorkflowStatus,
} from "@generated/prisma/enums";

export async function getOperationsSnapshot(
  currentUser: CurrentUserContext,
): Promise<OperationsSnapshot> {
  return buildOperationsSnapshot(currentUser.tenantCode);
}

export async function buildOperationsSnapshot(
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
    systemAdminCount,
    passkeyCredentialCount,
    privilegedUsers,
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
    prisma.user.count({
      where: {
        tenantId: tenant.id,
        isSystemAdmin: true,
      },
    }),
    prisma.webAuthnCredential.count({
      where: {
        tenantId: tenant.id,
      },
    }),
    prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { isSystemAdmin: true },
          {
            memberships: {
              some: {
                tenantId: tenant.id,
                status: MembershipStatus.ACTIVE,
                roleAssignments: {
                  some: {
                    role: {
                      tenantId: tenant.id,
                      permissions: {
                        some: {
                          permission: {
                            code: {
                              in: privilegedPermissionCodes,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        webAuthnCredentials: {
          select: {
            id: true,
          },
          take: 1,
        },
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
    hardening: buildHardeningChecklist({
      backupRecordCount,
      checkedAt: now.toISOString(),
      criticalSecurityEventCount,
      passkeyCredentialCount,
      privilegedUserCount: privilegedUsers.length,
      privilegedUsersWithPasskeyCount: privilegedUsers.filter(
        (user) => user.webAuthnCredentials.length > 0,
      ).length,
      requirePasskeyForPrivilegedUsers:
        tenant.requirePasskeyForPrivilegedUsers,
      retentionDays: tenant.auditLogRetentionDays,
      systemAdminCount,
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

function createBackupFilename(tenantCode: string, date: Date) {
  const dateStamp = date.toISOString().slice(0, 10).replaceAll("-", "");

  return `${tenantCode}-operations-${dateStamp}.json`;
}
