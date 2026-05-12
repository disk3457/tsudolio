import { prisma } from "@/lib/prisma";
import type { DashboardSnapshot } from "@/features/dashboard/types";
import {
  AuditSeverity,
  DocumentStatus,
  FacilityStatus,
  WorkflowPriority,
  WorkflowStatus,
} from "@/generated/prisma/enums";

const defaultTenantCode = "demo-city-hospital";

export async function getDashboardSnapshot(
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
): Promise<DashboardSnapshot> {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantCode}`);
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  const [
    activeUsers,
    pendingApprovals,
    auditEvents,
    unreadNotifications,
    todaysEvents,
    facilityCount,
    availableFacilities,
    noticeCount,
    activeDocuments,
    approvalRows,
    securityEvents,
  ] = await prisma.$transaction([
    prisma.membership.count({
      where: { tenantId: tenant.id, status: "ACTIVE" },
    }),
    prisma.workflowRequest.count({
      where: { tenantId: tenant.id, status: WorkflowStatus.PENDING },
    }),
    prisma.auditEvent.count({
      where: { tenantId: tenant.id },
    }),
    prisma.notification.count({
      where: { tenantId: tenant.id, readAt: null },
    }),
    prisma.calendarEvent.findMany({
      where: {
        tenantId: tenant.id,
        startsAt: {
          gte: now,
          lt: nextWeek,
        },
      },
      include: {
        organizationUnit: true,
      },
      orderBy: {
        startsAt: "asc",
      },
      take: 6,
    }),
    prisma.facility.count({
      where: { tenantId: tenant.id },
    }),
    prisma.facility.count({
      where: { tenantId: tenant.id, status: FacilityStatus.AVAILABLE },
    }),
    prisma.notice.count({
      where: {
        tenantId: tenant.id,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
    }),
    prisma.document.count({
      where: { tenantId: tenant.id, status: DocumentStatus.ACTIVE },
    }),
    prisma.workflowRequest.findMany({
      where: {
        tenantId: tenant.id,
        status: WorkflowStatus.PENDING,
      },
      include: {
        organizationUnit: true,
      },
      orderBy: [
        {
          priority: "desc",
        },
        {
          dueAt: "asc",
        },
      ],
      take: 5,
    }),
    prisma.auditEvent.findMany({
      where: {
        tenantId: tenant.id,
        severity: {
          in: [AuditSeverity.NOTICE, AuditSeverity.WARNING, AuditSeverity.CRITICAL],
        },
      },
      include: {
        actor: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
  ]);

  return {
    tenant: {
      code: tenant.code,
      name: tenant.displayName ?? tenant.name,
      type: tenant.type,
      timezone: tenant.timezone,
    },
    metrics: {
      activeUsers,
      pendingApprovals,
      auditEvents,
      unreadNotifications,
    },
    modules: [
      {
        key: "schedule",
        title: "予定・施設予約",
        status: "稼働中",
        summary: `今後7日間の予定 ${todaysEvents.length} 件、利用可能施設 ${availableFacilities}/${facilityCount} 件`,
      },
      {
        key: "notices",
        title: "掲示・回覧",
        status: noticeCount > 0 ? "確認あり" : "未掲示",
        summary: `有効な掲示 ${noticeCount} 件、未読通知 ${unreadNotifications} 件`,
      },
      {
        key: "workflow",
        title: "申請・承認",
        status: pendingApprovals > 0 ? "対応必要" : "滞留なし",
        summary: `承認待ち ${pendingApprovals} 件、緊急 ${countUrgent(approvalRows)} 件`,
      },
      {
        key: "documents",
        title: "文書管理",
        status: "管理中",
        summary: `有効文書 ${activeDocuments} 件、版管理と保管期限を追跡`,
      },
    ],
    timeline: todaysEvents.map((event) => ({
      startsAt: event.startsAt.toISOString(),
      title: event.title,
      location: event.location,
      organizationUnit: event.organizationUnit?.name ?? null,
    })),
    approvals: approvalRows.map((request) => ({
      title: request.title,
      category: request.category,
      owner: request.organizationUnit?.name ?? null,
      dueAt: request.dueAt?.toISOString() ?? null,
      priority: request.priority,
    })),
    securityEvents: securityEvents.map((event) => ({
      createdAt: event.createdAt.toISOString(),
      action: event.action,
      severity: event.severity,
      actor: event.actor?.displayName ?? null,
    })),
  };
}

function countUrgent(
  rows: Array<{
    priority: string;
  }>,
) {
  return rows.filter(
    (row) =>
      row.priority === WorkflowPriority.HIGH ||
      row.priority === WorkflowPriority.URGENT,
  ).length;
}
