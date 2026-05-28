import { NoticeApplicationError } from "@/application/notices/errors";
import type { NoticeRepository } from "@/application/notices/use-cases";
import type {
  NoticeCenterSnapshot,
  NoticeInput,
  NoticeSummary,
  NotificationSummary,
} from "@/application/notices/types";
import {
  hasPermission,
  permissions,
} from "@/application/security/permissions";
import type {
  CurrentUserContext,
  MutationContext,
} from "@/application/security/types";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";
import { AuditSeverity, MembershipStatus } from "@generated/prisma/enums";

export async function getNoticeCenterSnapshot(
  currentUser: CurrentUserContext,
): Promise<NoticeCenterSnapshot> {
  const canManage = hasPermission(currentUser, permissions.manageNotices);
  const now = new Date();
  const [
    tenant,
    notices,
    notifications,
    unreadNotificationCount,
    organizationUnits,
  ] = await Promise.all([
    prisma.tenant.findUnique({
      where: {
        id: currentUser.tenantId,
      },
      select: {
        code: true,
        name: true,
        displayName: true,
        timezone: true,
      },
    }),
    findNoticeRows(currentUser, canManage, now),
    prisma.notification.findMany({
      where: {
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
      },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: 16,
    }),
    prisma.notification.count({
      where: {
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
        readAt: null,
      },
    }),
    prisma.organizationUnit.findMany({
      where: {
        tenantId: currentUser.tenantId,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  if (!tenant) {
    throw new NoticeApplicationError(
      "TENANT_NOT_FOUND",
      `テナントが見つかりません: ${currentUser.tenantCode}`,
      404,
    );
  }

  const noticeSummaries = notices.map((notice) => mapNotice(notice, now));

  return {
    tenant: {
      code: tenant.code,
      name: tenant.displayName ?? tenant.name,
      timezone: tenant.timezone,
    },
    canManage,
    notices: noticeSummaries,
    notifications: notifications.map(mapNotification),
    organizationUnits,
    stats: {
      activeNotices: noticeSummaries.filter(
        (notice) => notice.status === "ACTIVE",
      ).length,
      acknowledgementRequired: noticeSummaries.filter(
        (notice) => notice.requiresAck && notice.status === "ACTIVE",
      ).length,
      unacknowledged: noticeSummaries.filter(
        (notice) => notice.canAcknowledge,
      ).length,
      unreadNotifications: unreadNotificationCount,
    },
  };
}

export async function createNotice(
  input: NoticeInput,
  context: MutationContext,
): Promise<NoticeSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);
  const now = new Date();

  const noticeId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );

    const notice = await tx.notice.create({
      data: {
        tenantId: tenant.id,
        organizationUnitId: input.organizationUnitId,
        title: input.title,
        body: input.body,
        requiresAck: input.requiresAck,
        publishedAt: new Date(input.publishedAt),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      select: {
        id: true,
      },
    });

    const recipientUserIds = shouldNotify(input, now)
      ? await findNoticeRecipientUserIds(
          tx,
          tenant.id,
          input.organizationUnitId,
        )
      : [];

    if (recipientUserIds.length > 0) {
      await tx.notification.createMany({
        data: recipientUserIds.map((userId) => ({
          tenantId: tenant.id,
          userId,
          title: `掲示: ${input.title}`,
          body: createNotificationBody(input.body),
        })),
      });
    }

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "掲示を作成",
      targetType: "notice",
      targetId: notice.id,
      severity: AuditSeverity.NOTICE,
      metadata: {
        title: input.title,
        requiresAck: input.requiresAck,
        organizationUnitId: input.organizationUnitId,
        notificationCount: recipientUserIds.length,
      },
    });

    return notice.id;
  });

  return getNoticeSummary(tenant.id, noticeId, context.actorUserId);
}

export async function updateNotice(
  noticeId: string,
  input: NoticeInput,
  context: MutationContext,
): Promise<NoticeSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);

  await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    const existingNotice = await tx.notice.findFirst({
      where: {
        id: noticeId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
      },
    });

    if (!existingNotice) {
      throw new NoticeApplicationError(
        "NOTICE_NOT_FOUND",
        "指定された掲示が見つかりません。",
        404,
      );
    }

    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );

    await tx.notice.update({
      where: { id: noticeId },
      data: {
        organizationUnitId: input.organizationUnitId,
        title: input.title,
        body: input.body,
        requiresAck: input.requiresAck,
        publishedAt: new Date(input.publishedAt),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "掲示を更新",
      targetType: "notice",
      targetId: noticeId,
      severity: AuditSeverity.NOTICE,
      metadata: {
        title: input.title,
        requiresAck: input.requiresAck,
        organizationUnitId: input.organizationUnitId,
      },
    });
  });

  return getNoticeSummary(tenant.id, noticeId, context.actorUserId);
}

export async function deleteNotice(
  noticeId: string,
  context: MutationContext,
) {
  const tenant = await getTenantOrThrow(context.tenantCode);

  await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    const existingNotice = await tx.notice.findFirst({
      where: {
        id: noticeId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        title: true,
        requiresAck: true,
        organizationUnitId: true,
      },
    });

    if (!existingNotice) {
      throw new NoticeApplicationError(
        "NOTICE_NOT_FOUND",
        "指定された掲示が見つかりません。",
        404,
      );
    }

    await tx.notice.delete({
      where: { id: noticeId },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "掲示を削除",
      targetType: "notice",
      targetId: noticeId,
      severity: AuditSeverity.WARNING,
      metadata: {
        title: existingNotice.title,
        requiresAck: existingNotice.requiresAck,
        organizationUnitId: existingNotice.organizationUnitId,
      },
    });
  });
}

export async function acknowledgeNotice(
  noticeId: string,
  currentUser: CurrentUserContext,
  context: MutationContext,
): Promise<NoticeSummary> {
  await prisma.$transaction(async (tx) => {
    const notice = await tx.notice.findFirst({
      where: {
        id: noticeId,
        tenantId: currentUser.tenantId,
      },
      select: {
        id: true,
        title: true,
        organizationUnitId: true,
        requiresAck: true,
        publishedAt: true,
        expiresAt: true,
      },
    });

    const now = new Date();

    if (!notice || !isNoticeVisibleToUser(notice, currentUser, now)) {
      throw new NoticeApplicationError(
        "NOTICE_NOT_FOUND",
        "指定された掲示が見つかりません。",
        404,
      );
    }

    if (!notice.requiresAck) {
      throw new NoticeApplicationError(
        "ACKNOWLEDGEMENT_NOT_REQUIRED",
        "この掲示は確認操作が不要です。",
      );
    }

    if (!isNoticeActive(notice, now)) {
      throw new NoticeApplicationError(
        "NOTICE_NOT_ACTIVE",
        "掲載中の掲示のみ確認できます。",
      );
    }

    await tx.noticeAcknowledgement.upsert({
      where: {
        tenantId_noticeId_userId: {
          tenantId: currentUser.tenantId,
          noticeId,
          userId: currentUser.userId,
        },
      },
      create: {
        tenantId: currentUser.tenantId,
        noticeId,
        userId: currentUser.userId,
      },
      update: {},
    });

    await recordAuditEvent(tx, {
      tenantId: currentUser.tenantId,
      context,
      action: "掲示を確認",
      targetType: "notice",
      targetId: noticeId,
      severity: AuditSeverity.INFO,
      metadata: {
        title: notice.title,
      },
    });
  });

  return getNoticeSummary(currentUser.tenantId, noticeId, currentUser.userId);
}

export async function markNotificationRead(
  notificationId: string,
  currentUser: CurrentUserContext,
): Promise<NotificationSummary> {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
    },
    select: {
      id: true,
      readAt: true,
    },
  });

  if (!notification) {
    throw new NoticeApplicationError(
      "NOTIFICATION_NOT_FOUND",
      "指定された通知が見つかりません。",
      404,
    );
  }

  if (!notification.readAt) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date(),
      },
    });
  }

  return getNotificationSummary(
    currentUser.tenantId,
    currentUser.userId,
    notificationId,
  );
}

async function getTenantOrThrow(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new NoticeApplicationError(
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
  const user = await tx.user.findFirst({
    where: {
      id: userId,
      tenantId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new NoticeApplicationError(
      "USER_NOT_FOUND",
      "掲示を操作する利用者が見つかりません。",
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
    throw new NoticeApplicationError(
      "ORGANIZATION_UNIT_NOT_FOUND",
      "指定された組織が見つかりません。",
      404,
    );
  }
}

async function findNoticeRows(
  currentUser: CurrentUserContext,
  canManage: boolean,
  now: Date,
) {
  return prisma.notice.findMany({
    where: buildNoticeWhere(currentUser, canManage, now),
    include: {
      organizationUnit: true,
      acknowledgements: {
        where: {
          userId: currentUser.userId,
        },
        select: {
          acknowledgedAt: true,
        },
        take: 1,
      },
    },
    orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
    take: canManage ? 80 : 40,
  });
}

type NoticeRecord = Awaited<ReturnType<typeof findNoticeRows>>[number];

function buildNoticeWhere(
  currentUser: CurrentUserContext,
  canManage: boolean,
  now: Date,
): Prisma.NoticeWhereInput {
  if (canManage) {
    return {
      tenantId: currentUser.tenantId,
    };
  }

  return {
    tenantId: currentUser.tenantId,
    AND: [
      buildNoticeVisibilityWhere(currentUser),
      {
        publishedAt: {
          lte: now,
        },
      },
      {
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
    ],
  };
}

function buildNoticeVisibilityWhere(
  currentUser: CurrentUserContext,
): Prisma.NoticeWhereInput {
  const organizationUnitIds = currentUser.organizationUnitIds;

  if (organizationUnitIds.length === 0) {
    return {
      organizationUnitId: null,
    };
  }

  return {
    OR: [
      { organizationUnitId: null },
      { organizationUnitId: { in: organizationUnitIds } },
    ],
  };
}

async function getNoticeSummary(
  tenantId: string,
  noticeId: string,
  userId: string,
): Promise<NoticeSummary> {
  const notice = await prisma.notice.findFirst({
    where: {
      id: noticeId,
      tenantId,
    },
    include: {
      organizationUnit: true,
      acknowledgements: {
        where: {
          userId,
        },
        select: {
          acknowledgedAt: true,
        },
        take: 1,
      },
    },
  });

  if (!notice) {
    throw new NoticeApplicationError(
      "NOTICE_NOT_FOUND",
      "指定された掲示が見つかりません。",
      404,
    );
  }

  return mapNotice(notice, new Date());
}

async function getNotificationSummary(
  tenantId: string,
  userId: string,
  notificationId: string,
): Promise<NotificationSummary> {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      tenantId,
      userId,
    },
  });

  if (!notification) {
    throw new NoticeApplicationError(
      "NOTIFICATION_NOT_FOUND",
      "指定された通知が見つかりません。",
      404,
    );
  }

  return mapNotification(notification);
}

function mapNotice(notice: NoticeRecord, now: Date): NoticeSummary {
  const status = getNoticeStatus(notice, now);
  const acknowledgedAt = notice.acknowledgements[0]?.acknowledgedAt ?? null;

  return {
    id: notice.id,
    title: notice.title,
    body: notice.body,
    requiresAck: notice.requiresAck,
    publishedAt: notice.publishedAt.toISOString(),
    expiresAt: notice.expiresAt?.toISOString() ?? null,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
    status,
    statusLabel: getNoticeStatusLabel(status),
    tone: getNoticeTone(status),
    organizationUnit: notice.organizationUnit
      ? {
          id: notice.organizationUnit.id,
          name: notice.organizationUnit.name,
        }
      : null,
    acknowledgedAt: acknowledgedAt?.toISOString() ?? null,
    canAcknowledge:
      notice.requiresAck && status === "ACTIVE" && acknowledgedAt === null,
  };
}

function mapNotification(notification: {
  id: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}): NotificationSummary {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

function getNoticeStatus(
  notice: {
    publishedAt: Date;
    expiresAt: Date | null;
  },
  now: Date,
): NoticeSummary["status"] {
  if (notice.publishedAt.getTime() > now.getTime()) {
    return "SCHEDULED";
  }

  if (notice.expiresAt && notice.expiresAt.getTime() < now.getTime()) {
    return "EXPIRED";
  }

  return "ACTIVE";
}

function getNoticeStatusLabel(status: NoticeSummary["status"]) {
  const labels: Record<NoticeSummary["status"], string> = {
    SCHEDULED: "公開予定",
    ACTIVE: "掲載中",
    EXPIRED: "掲載終了",
  };

  return labels[status];
}

function getNoticeTone(status: NoticeSummary["status"]): NoticeSummary["tone"] {
  if (status === "ACTIVE") {
    return "open";
  }

  if (status === "SCHEDULED") {
    return "wait";
  }

  return "busy";
}

function isNoticeVisibleToUser(
  notice: {
    organizationUnitId: string | null;
    publishedAt: Date;
    expiresAt: Date | null;
  },
  currentUser: CurrentUserContext,
  now: Date,
) {
  if (hasPermission(currentUser, permissions.manageNotices)) {
    return true;
  }

  if (!isNoticeActive(notice, now)) {
    return false;
  }

  return (
    notice.organizationUnitId === null ||
    currentUser.organizationUnitIds.includes(notice.organizationUnitId)
  );
}

function isNoticeActive(
  notice: {
    publishedAt: Date;
    expiresAt: Date | null;
  },
  now: Date,
) {
  return (
    notice.publishedAt.getTime() <= now.getTime() &&
    (!notice.expiresAt || notice.expiresAt.getTime() >= now.getTime())
  );
}

function shouldNotify(input: NoticeInput, now: Date) {
  const publishedAt = new Date(input.publishedAt);
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  return (
    publishedAt.getTime() <= now.getTime() &&
    (!expiresAt || expiresAt.getTime() >= now.getTime())
  );
}

async function findNoticeRecipientUserIds(
  tx: Prisma.TransactionClient,
  tenantId: string,
  organizationUnitId: string | null,
) {
  const memberships = await tx.membership.findMany({
    where: {
      tenantId,
      status: MembershipStatus.ACTIVE,
      ...(organizationUnitId ? { organizationUnitId } : {}),
    },
    distinct: ["userId"],
    select: {
      userId: true,
    },
  });

  return memberships.map((membership) => membership.userId);
}

function createNotificationBody(body: string) {
  const trimmed = body.replace(/\s+/g, " ").trim();

  if (trimmed.length <= 180) {
    return trimmed;
  }

  return `${trimmed.slice(0, 177)}...`;
}

export const prismaNoticeRepository = {
  getNoticeCenterSnapshot,
  createNotice,
  updateNotice,
  deleteNotice,
  acknowledgeNotice,
  markNotificationRead,
} satisfies NoticeRepository;
