import type { OperationsRepository } from "@/application/operations/use-cases";
import type {
  OperationHardeningChecklist,
  OperationHardeningItem,
  OperationHardeningStatus,
  OperationHealthCheck,
  OperationImportIssue,
  OperationImportTableSummary,
  OperationMetric,
  OperationsBackupDataKey,
  OperationsBackupSnapshot,
  OperationsImportCandidate,
  OperationsImportValidationReport,
  OperationsSnapshot,
  TenantProfile,
  TenantProfileInput,
  TenantTypeValue,
} from "@/application/operations/types";
import { operationsBackupDataSetDefinitions } from "@/application/operations/types";
import { ApplicationError } from "@/application/shared/application-error";
import type {
  CurrentUserContext,
  MutationContext,
} from "@/application/security/types";
import { privilegedAuthenticationPermissionCodes } from "@/application/security/permissions";
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
const privilegedPermissionCodes = [...privilegedAuthenticationPermissionCodes];
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

export async function validateOperationsImportCandidate(
  input: OperationsImportCandidate,
  context: MutationContext,
): Promise<OperationsImportValidationReport> {
  const tenant = await getTenantByCodeOrThrow(context.tenantCode);
  const currentCounts = await getCurrentBackupTableCounts(tenant.id);
  const issues: OperationImportIssue[] = [...input.validationIssues];

  if (input.tenant.code && input.tenant.code !== tenant.code) {
    issues.push({
      detail: `バックアップのテナントコード ${input.tenant.code} は現在のテナント ${tenant.code} と一致しません。`,
      key: "tenant-code-mismatch",
      label: "Tenant code",
      severity: "ERROR",
    });
  }

  if (
    input.tenant.name &&
    input.tenant.code === tenant.code &&
    input.tenant.name !== tenant.name
  ) {
    issues.push({
      detail: `バックアップ名 ${input.tenant.name} と現在名 ${tenant.name} が異なります。`,
      key: "tenant-name-differs",
      label: "Tenant name",
      severity: "INFO",
    });
  }

  const backupTenantIds = collectBackupTenantIds(input.data);

  if (backupTenantIds.size > 1) {
    issues.push({
      detail: `バックアップ内に複数の tenantId が含まれています: ${Array.from(
        backupTenantIds,
      ).join(", ")}`,
      key: "multiple-row-tenant-ids",
      label: "Tenant id",
      severity: "ERROR",
    });
  } else if (
    backupTenantIds.size === 1 &&
    !backupTenantIds.has(tenant.id) &&
    input.tenant.code === tenant.code
  ) {
    issues.push({
      detail:
        "バックアップ内の行 tenantId は現在の tenantId と異なります。別環境からの復元ではIDの再マッピングが必要です。",
      key: "row-tenant-id-differs",
      label: "Tenant id",
      severity: "WARNING",
    });
  }

  const tables = buildImportTableSummaries(input, currentCounts);
  const totalIncomingRecords = tables.reduce(
    (total, table) => total + table.incomingCount,
    0,
  );
  const totalCurrentRecords = tables.reduce(
    (total, table) => total + table.currentCount,
    0,
  );
  const status = getImportValidationStatus(issues);
  const report = {
    currentTenant: {
      code: tenant.code,
      name: tenant.displayName ?? tenant.name,
    },
    exportedAt: input.exportedAt,
    generatedAt: new Date().toISOString(),
    issues,
    schemaVersion: input.schemaVersion,
    status,
    tables,
    tenant: input.tenant,
    totalCurrentRecords,
    totalIncomingRecords,
  } satisfies OperationsImportValidationReport;

  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "運用バックアップのインポート検証",
      targetType: "operations-import",
      targetId: input.tenant.code ?? tenant.code,
      severity:
        status === "BLOCKED" ? AuditSeverity.WARNING : AuditSeverity.NOTICE,
      metadata: {
        exportedAt: input.exportedAt,
        importedTenantCode: input.tenant.code,
        issueCount: issues.length,
        schemaVersion: input.schemaVersion,
        status,
        totalCurrentRecords,
        totalIncomingRecords,
      },
    });
  });

  return report;
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

function buildHardeningChecklist(input: {
  backupRecordCount: number;
  checkedAt: string;
  criticalSecurityEventCount: number;
  passkeyCredentialCount: number;
  privilegedUserCount: number;
  privilegedUsersWithPasskeyCount: number;
  requirePasskeyForPrivilegedUsers: boolean;
  retentionDays: number;
  systemAdminCount: number;
  warningSecurityEventCount: number;
}): OperationHardeningChecklist {
  const sessionSecretStatus = getSessionSecretStatus();
  const mailStatus = getMailDeliveryStatus();
  const oidcStatus = getOidcProviderStatus();
  const missingPrivilegedPasskeys =
    input.privilegedUserCount - input.privilegedUsersWithPasskeyCount;
  const items: OperationHardeningItem[] = [
    {
      key: "session-secret",
      label: "セッション秘密値",
      status: sessionSecretStatus,
      detail:
        sessionSecretStatus === "OK"
          ? "署名済みセッションCookieの秘密値は運用可能な長さです。"
          : "AUTH_SESSION_SECRETを32文字以上のランダム値に更新してください。",
      evidence:
        sessionSecretStatus === "OK"
          ? "32文字以上の値を検出"
          : "未設定またはサンプル値",
    },
    {
      key: "admin-accounts",
      label: "管理者アカウント",
      status:
        input.systemAdminCount === 0
          ? "ACTION_REQUIRED"
          : input.systemAdminCount > 3
            ? "ATTENTION"
            : "OK",
      detail:
        input.systemAdminCount === 0
          ? "緊急時の管理者アカウントを少なくとも1件用意してください。"
          : input.systemAdminCount > 3
            ? "システム管理者が多めです。権限棚卸しを確認してください。"
            : "システム管理者の人数は最小構成です。",
      evidence: `${input.systemAdminCount}人`,
    },
    {
      key: "privileged-passkey-policy",
      label: "高権限Passkey必須",
      status: input.requirePasskeyForPrivilegedUsers
        ? "OK"
        : "ACTION_REQUIRED",
      detail: input.requirePasskeyForPrivilegedUsers
        ? "高権限利用者はPasskeyまたは回復コードでの認証に制限されています。"
        : "高権限利用者にPasskey必須ポリシーを適用してください。",
      evidence: input.requirePasskeyForPrivilegedUsers ? "有効" : "無効",
    },
    {
      key: "privileged-passkey-coverage",
      label: "高権限Passkey登録",
      status:
        input.privilegedUserCount === 0 || missingPrivilegedPasskeys > 0
          ? input.privilegedUsersWithPasskeyCount === 0
            ? "ACTION_REQUIRED"
            : "ATTENTION"
          : "OK",
      detail:
        input.privilegedUserCount === 0
          ? "高権限利用者が見つかりません。管理者設定を確認してください。"
          : missingPrivilegedPasskeys > 0
            ? "高権限利用者の一部にPasskey登録がありません。"
            : "高権限利用者は全員Passkeyを登録済みです。",
      evidence: `${input.privilegedUsersWithPasskeyCount}/${input.privilegedUserCount}人 / 全体${input.passkeyCredentialCount}件`,
    },
    {
      key: "audit-retention",
      label: "監査ログ保持",
      status:
        input.retentionDays >= 365
          ? "OK"
          : input.retentionDays >= 180
            ? "ATTENTION"
            : "ACTION_REQUIRED",
      detail:
        input.retentionDays >= 365
          ? "監査ログ保持期間はMVP基準を満たしています。"
          : "監査ログ保持期間を365日以上に設定してください。",
      evidence: `${input.retentionDays}日`,
    },
    {
      key: "backup-export",
      label: "バックアップエクスポート",
      status: input.backupRecordCount > 0 ? "OK" : "ACTION_REQUIRED",
      detail:
        input.backupRecordCount > 0
          ? "運用エクスポート対象データを検出しています。"
          : "復元前チェックに使える運用エクスポート対象がありません。",
      evidence: `${input.backupRecordCount}レコード`,
    },
    {
      key: "password-reset-mail",
      label: "パスワードリセット配送",
      status: mailStatus,
      detail:
        mailStatus === "OK"
          ? "MAIL_FROMとSMTPホストが設定されています。"
          : "パスワードリセットメール配送の環境変数を設定してください。",
      evidence: mailStatus === "OK" ? "SMTP設定あり" : "SMTP設定不足",
    },
    {
      key: "oidc-provider",
      label: "OIDCプロバイダー",
      status: oidcStatus,
      detail:
        oidcStatus === "OK"
          ? "OIDCログインに必要な主要設定があります。"
          : "本番運用前にOIDC_ISSUER_URLとクライアント設定を確認してください。",
      evidence: oidcStatus === "OK" ? "設定あり" : "未設定",
    },
    {
      key: "security-events",
      label: "直近重大イベント",
      status:
        input.criticalSecurityEventCount > 0
          ? "ACTION_REQUIRED"
          : input.warningSecurityEventCount > 0
            ? "ATTENTION"
            : "OK",
      detail:
        input.criticalSecurityEventCount > 0
          ? "直近24時間にCRITICAL監査イベントがあります。"
          : input.warningSecurityEventCount > 0
            ? "直近24時間にWARNING監査イベントがあります。"
            : "直近24時間に警告以上の監査イベントはありません。",
      evidence: `CRITICAL ${input.criticalSecurityEventCount}件 / WARNING ${input.warningSecurityEventCount}件`,
    },
  ];
  const completedCount = items.filter((item) => item.status === "OK").length;
  const attentionCount = items.filter(
    (item) => item.status === "ATTENTION",
  ).length;
  const actionRequiredCount = items.filter(
    (item) => item.status === "ACTION_REQUIRED",
  ).length;

  return {
    actionRequiredCount,
    attentionCount,
    completedCount,
    generatedAt: input.checkedAt,
    items,
    score: Math.round((completedCount / items.length) * 100),
    status: getAggregateHardeningStatus(items),
    totalCount: items.length,
  };
}

function getSessionSecretStatus(): OperationHardeningStatus {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();

  if (
    secret &&
    secret.length >= 32 &&
    !secret.includes("replace-with") &&
    !secret.includes("change-me")
  ) {
    return "OK";
  }

  return "ACTION_REQUIRED";
}

function getMailDeliveryStatus(): OperationHardeningStatus {
  return process.env.MAIL_FROM?.trim() && process.env.MAIL_SMTP_HOST?.trim()
    ? "OK"
    : "ACTION_REQUIRED";
}

function getOidcProviderStatus(): OperationHardeningStatus {
  return process.env.OIDC_ISSUER_URL?.trim() &&
    process.env.OIDC_CLIENT_ID?.trim() &&
    process.env.OIDC_CLIENT_SECRET?.trim()
    ? "OK"
    : "ATTENTION";
}

function getAggregateHardeningStatus(
  items: OperationHardeningItem[],
): OperationHardeningStatus {
  if (items.some((item) => item.status === "ACTION_REQUIRED")) {
    return "ACTION_REQUIRED";
  }

  if (items.some((item) => item.status === "ATTENTION")) {
    return "ATTENTION";
  }

  return "OK";
}

async function getCurrentBackupTableCounts(
  tenantId: string,
): Promise<Record<OperationsBackupDataKey, number>> {
  const counts = await prisma.$transaction([
    prisma.organizationUnit.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId } }),
    prisma.membership.count({ where: { tenantId } }),
    prisma.role.count({ where: { tenantId } }),
    prisma.permission.count({
      where: {
        roles: {
          some: {
            role: {
              tenantId,
            },
          },
        },
      },
    }),
    prisma.rolePermission.count({
      where: {
        role: {
          tenantId,
        },
      },
    }),
    prisma.roleAssignment.count({
      where: {
        role: {
          tenantId,
        },
      },
    }),
    prisma.facility.count({ where: { tenantId } }),
    prisma.calendarEvent.count({ where: { tenantId } }),
    prisma.facilityReservation.count({ where: { tenantId } }),
    prisma.notice.count({ where: { tenantId } }),
    prisma.noticeAcknowledgement.count({ where: { tenantId } }),
    prisma.workflowRequest.count({ where: { tenantId } }),
    prisma.document.count({ where: { tenantId } }),
    prisma.documentVersion.count({ where: { tenantId } }),
  ]);

  return Object.fromEntries(
    operationsBackupDataSetDefinitions.map((definition, index) => [
      definition.key,
      counts[index] ?? 0,
    ]),
  ) as Record<OperationsBackupDataKey, number>;
}

function buildImportTableSummaries(
  input: OperationsImportCandidate,
  currentCounts: Record<OperationsBackupDataKey, number>,
): OperationImportTableSummary[] {
  return operationsBackupDataSetDefinitions.map((definition) => {
    const incomingCount = input.data[definition.key]?.length ?? 0;
    const currentCount = currentCounts[definition.key];
    const declaredCount = input.counts[definition.key] ?? null;

    return {
      currentCount,
      declaredCount,
      incomingCount,
      key: definition.key,
      label: definition.label,
      status:
        declaredCount === null
          ? "MISSING"
          : incomingCount === currentCount
            ? "MATCH"
            : "CHANGED",
    };
  });
}

function getImportValidationStatus(issues: OperationImportIssue[]) {
  if (issues.some((issue) => issue.severity === "ERROR")) {
    return "BLOCKED";
  }

  if (issues.some((issue) => issue.severity === "WARNING")) {
    return "WARNING";
  }

  return "READY";
}

function collectBackupTenantIds(data: Record<string, unknown[]>) {
  const tenantIds = new Set<string>();

  for (const rows of Object.values(data)) {
    for (const row of rows) {
      if (!isRecord(row)) {
        continue;
      }

      const tenantId = row.tenantId;

      if (typeof tenantId === "string" && tenantId.trim()) {
        tenantIds.add(tenantId);
      }
    }
  }

  return tenantIds;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  validateOperationsImportCandidate,
} satisfies OperationsRepository;
