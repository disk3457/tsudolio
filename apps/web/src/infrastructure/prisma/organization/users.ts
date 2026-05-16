import { OrganizationApplicationError } from "@/application/organization/errors";
import type {
  UserInput,
  UserSummary,
} from "@/application/organization/types";
import type { MutationContext } from "@/application/security/types";
import { hashPassword } from "@/infrastructure/auth/password";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import {
  assertOrganizationBelongsToTenant,
  assertUserBelongsToTenant,
  getTenantOrThrow,
} from "@/infrastructure/prisma/organization/common";
import { getUserSummary } from "@/infrastructure/prisma/organization/queries";
import { syncUserMembershipAndRoles } from "@/infrastructure/prisma/organization/user-role-assignments";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";
import {
  AuditSeverity,
  MembershipStatus,
} from "@generated/prisma/enums";

export async function createUser(
  input: UserInput,
  context: MutationContext,
): Promise<UserSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : null;

  const userId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: input.email,
        displayName: input.displayName,
        kanaName: input.kanaName,
        title: input.title,
        isSystemAdmin: input.isSystemAdmin,
      },
      select: {
        id: true,
      },
    });

    if (passwordHash) {
      await tx.userCredential.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          passwordHash,
          passwordChangedAt: new Date(),
        },
      });
    }

    const roleSync = await syncUserMembershipAndRoles(
      tx,
      tenant.id,
      user.id,
      input.organizationUnitId,
      input.roleIds,
    );

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "利用者を作成",
      targetType: "user",
      targetId: user.id,
      severity: input.isSystemAdmin
        ? AuditSeverity.WARNING
        : AuditSeverity.NOTICE,
      metadata: {
        email: input.email,
        displayName: input.displayName,
        organizationUnitId: input.organizationUnitId,
        isSystemAdmin: input.isSystemAdmin,
        passwordLoginEnabled: Boolean(passwordHash),
        roleIds: roleSync.roleIds,
        roleAssignmentCount: roleSync.roleIds.length,
      },
    });

    if (passwordHash) {
      await recordAuditEvent(tx, {
        tenantId: tenant.id,
        context,
        action: "利用者パスワードを設定",
        targetType: "user",
        targetId: user.id,
        severity: AuditSeverity.WARNING,
        metadata: {
          email: input.email,
          passwordLoginEnabled: true,
        },
      });
    }

    if (roleSync.changed && roleSync.roleIds.length > 0) {
      await recordAuditEvent(tx, {
        tenantId: tenant.id,
        context,
        action: "利用者ロールを設定",
        targetType: "user",
        targetId: user.id,
        severity: AuditSeverity.WARNING,
        metadata: {
          email: input.email,
          organizationUnitId: input.organizationUnitId,
          roleIds: roleSync.roleIds,
        },
      });
    }

    return user.id;
  });

  return getUserSummary(tenant.id, userId);
}

export async function updateUser(
  userId: string,
  input: UserInput,
  context: MutationContext,
): Promise<UserSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : null;

  const updatedUserId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    const existingUser = await tx.user.findFirst({
      where: {
        id: userId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        isSystemAdmin: true,
        credential: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw new OrganizationApplicationError(
        "USER_NOT_FOUND",
        "指定された利用者が見つかりません。",
        404,
      );
    }

    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );

    await tx.user.update({
      where: { id: userId },
      data: {
        email: input.email,
        displayName: input.displayName,
        kanaName: input.kanaName,
        title: input.title,
        isSystemAdmin: input.isSystemAdmin,
      },
    });

    if (input.organizationUnitId) {
      await tx.membership.upsert({
        where: {
          tenantId_userId_organizationUnitId: {
            tenantId: tenant.id,
            userId,
            organizationUnitId: input.organizationUnitId,
          },
        },
        create: {
          tenantId: tenant.id,
          userId,
          organizationUnitId: input.organizationUnitId,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          status: MembershipStatus.ACTIVE,
          leftAt: null,
        },
      });
    }

    if (passwordHash) {
      await tx.userCredential.upsert({
        where: {
          userId,
        },
        create: {
          tenantId: tenant.id,
          userId,
          passwordHash,
          passwordChangedAt: new Date(),
        },
        update: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    const roleSync = await syncUserMembershipAndRoles(
      tx,
      tenant.id,
      userId,
      input.organizationUnitId,
      input.roleIds,
    );

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "利用者を更新",
      targetType: "user",
      targetId: userId,
      severity: input.isSystemAdmin || existingUser.isSystemAdmin
        ? AuditSeverity.WARNING
        : AuditSeverity.NOTICE,
      metadata: {
        email: input.email,
        displayName: input.displayName,
        organizationUnitId: input.organizationUnitId,
        isSystemAdminBefore: existingUser.isSystemAdmin,
        isSystemAdminAfter: input.isSystemAdmin,
        passwordCredentialChanged: Boolean(passwordHash),
        roleIdsBefore: roleSync.previousRoleIds,
        roleIdsAfter: roleSync.roleIds,
        roleAssignmentChanged: roleSync.changed,
      },
    });

    if (passwordHash) {
      await recordAuditEvent(tx, {
        tenantId: tenant.id,
        context,
        action: existingUser.credential
          ? "利用者パスワードを更新"
          : "利用者パスワードを設定",
        targetType: "user",
        targetId: userId,
        severity: AuditSeverity.WARNING,
        metadata: {
          email: input.email,
          passwordLoginEnabled: true,
        },
      });
    }

    if (roleSync.changed) {
      await recordAuditEvent(tx, {
        tenantId: tenant.id,
        context,
        action: "利用者ロールを更新",
        targetType: "user",
        targetId: userId,
        severity: AuditSeverity.WARNING,
        metadata: {
          email: input.email,
          organizationUnitId: input.organizationUnitId,
          roleIdsBefore: roleSync.previousRoleIds,
          roleIdsAfter: roleSync.roleIds,
        },
      });
    }

    return userId;
  });

  return getUserSummary(tenant.id, updatedUserId);
}

export async function deleteOrSuspendUser(
  userId: string,
  context: MutationContext,
) {
  const tenant = await getTenantOrThrow(context.tenantCode);

  return prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    const user = await tx.user.findFirst({
      where: {
        id: userId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        isSystemAdmin: true,
      },
    });

    if (!user) {
      throw new OrganizationApplicationError(
        "USER_NOT_FOUND",
        "指定された利用者が見つかりません。",
        404,
      );
    }

    const blockingReferenceCount = await countUserReferences(tx, tenant.id, userId);

    if (blockingReferenceCount === 0) {
      await recordAuditEvent(tx, {
        tenantId: tenant.id,
        context,
        action: "利用者を削除",
        targetType: "user",
        targetId: userId,
        severity: AuditSeverity.WARNING,
        metadata: {
          email: user.email,
          displayName: user.displayName,
          isSystemAdmin: user.isSystemAdmin,
        },
      });

      await tx.user.delete({
        where: { id: userId },
      });

      return {
        id: userId,
        deleted: true,
        suspended: false,
      };
    }

    await tx.membership.updateMany({
      where: {
        tenantId: tenant.id,
        userId,
        status: {
          not: MembershipStatus.LEFT,
        },
      },
      data: {
        status: MembershipStatus.SUSPENDED,
      },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "利用者を停止",
      targetType: "user",
      targetId: userId,
      severity: AuditSeverity.WARNING,
      metadata: {
        email: user.email,
        displayName: user.displayName,
        isSystemAdmin: user.isSystemAdmin,
        blockingReferenceCount,
      },
    });

    return {
      id: userId,
      deleted: false,
      suspended: true,
    };
  });
}

async function countUserReferences(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
) {
  const [
    createdEvents,
    workflowRequests,
    uploadedDocuments,
    auditEvents,
    notifications,
  ] = await Promise.all([
    tx.calendarEvent.count({
      where: { tenantId, createdById: userId },
    }),
    tx.workflowRequest.count({
      where: { tenantId, requesterId: userId },
    }),
    tx.document.count({
      where: { tenantId, uploadedById: userId },
    }),
    tx.auditEvent.count({
      where: { tenantId, actorId: userId },
    }),
    tx.notification.count({
      where: { tenantId, userId },
    }),
  ]);

  return (
    createdEvents +
    workflowRequests +
    uploadedDocuments +
    auditEvents +
    notifications
  );
}
