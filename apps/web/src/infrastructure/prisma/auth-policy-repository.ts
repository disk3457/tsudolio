import { ApplicationError } from "@/application/shared/application-error";
import {
  isPrivilegedForAuthPolicy,
  privilegedAuthenticationPermissionCodes,
  toMutationContext,
} from "@/application/security/permissions";
import type {
  AuthPolicy,
  CurrentUserContext,
} from "@/application/security/types";
import type { AuthSessionProvider } from "@/infrastructure/auth/session-cookie";
import {
  recordAuditEvent,
  recordAuthAuditEvent,
} from "@/infrastructure/prisma/audit-event-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";
import { AuditSeverity, MembershipStatus } from "@generated/prisma/enums";

export async function getAuthPolicy(
  currentUser: CurrentUserContext,
): Promise<AuthPolicy> {
  return buildAuthPolicySnapshot(currentUser);
}

export async function updateAuthPolicy(input: {
  currentUser: CurrentUserContext;
  requirePasskeyForPrivilegedUsers: boolean;
  ipAddress?: string | null;
}): Promise<AuthPolicy> {
  const before = await buildAuthPolicySnapshot(input.currentUser);

  if (
    input.requirePasskeyForPrivilegedUsers &&
    before.currentUserPasskeyCount === 0
  ) {
    throw new ApplicationError(
      "AUTH_POLICY_CURRENT_USER_PASSKEY_REQUIRED",
      "Passkey必須化の前に、自分のPasskeyを1件以上登録してください。",
      409,
    );
  }

  if (
    before.requirePasskeyForPrivilegedUsers ===
    input.requirePasskeyForPrivilegedUsers
  ) {
    return before;
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: {
        id: input.currentUser.tenantId,
      },
      data: {
        requirePasskeyForPrivilegedUsers:
          input.requirePasskeyForPrivilegedUsers,
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
      action: "認証ポリシーを更新",
      targetType: "tenant",
      targetId: input.currentUser.tenantId,
      severity: AuditSeverity.NOTICE,
      metadata: {
        requirePasskeyForPrivilegedUsersBefore:
          before.requirePasskeyForPrivilegedUsers,
        requirePasskeyForPrivilegedUsersAfter:
          input.requirePasskeyForPrivilegedUsers,
        privilegedUserCount: before.privilegedUserCount,
        privilegedUsersWithoutPasskeyCount:
          before.privilegedUsersWithoutPasskeyCount,
      },
    });
  });

  return buildAuthPolicySnapshot(input.currentUser);
}

export async function assertAuthPolicyAllowsLogin(input: {
  currentUser: CurrentUserContext;
  provider: AuthSessionProvider;
  ipAddress?: string | null;
  subject?: string | null;
}) {
  if (
    input.provider === "passkey" ||
    input.provider === "recovery_code" ||
    !isPrivilegedForAuthPolicy(input.currentUser)
  ) {
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      id: input.currentUser.tenantId,
    },
    select: {
      requirePasskeyForPrivilegedUsers: true,
    },
  });

  if (!tenant?.requirePasskeyForPrivilegedUsers) {
    return;
  }

  await recordAuthAuditEvent({
    tenantId: input.currentUser.tenantId,
    actorId: input.currentUser.userId,
    action: "Passkey必須ログイン拒否",
    targetType: "user",
    targetId: input.currentUser.userId,
    severity: AuditSeverity.WARNING,
    ipAddress: input.ipAddress ?? null,
    metadata: {
      email: input.currentUser.email,
      outcome: "passkey_required",
      provider: input.provider,
      ...(input.subject ? { subject: input.subject } : {}),
    },
  });

  throw new ApplicationError(
    "PASSKEY_REQUIRED_FOR_PRIVILEGED_USER",
    "この利用者はPasskeyでログインしてください。",
    403,
  );
}

async function buildAuthPolicySnapshot(
  currentUser: CurrentUserContext,
): Promise<AuthPolicy> {
  const privilegedUserWhere = createPrivilegedUserWhere(currentUser.tenantId);
  const [tenant, privilegedUserCount, privilegedUsersWithoutPasskeyCount, currentUserPasskeyCount] =
    await prisma.$transaction([
      prisma.tenant.findUnique({
        where: {
          id: currentUser.tenantId,
        },
        select: {
          requirePasskeyForPrivilegedUsers: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({
        where: privilegedUserWhere,
      }),
      prisma.user.count({
        where: {
          ...privilegedUserWhere,
          webAuthnCredentials: {
            none: {},
          },
        },
      }),
      prisma.webAuthnCredential.count({
        where: {
          tenantId: currentUser.tenantId,
          userId: currentUser.userId,
        },
      }),
    ]);

  if (!tenant) {
    throw new ApplicationError(
      "TENANT_NOT_FOUND",
      "テナントが見つかりません。",
      404,
    );
  }

  return {
    requirePasskeyForPrivilegedUsers:
      tenant.requirePasskeyForPrivilegedUsers,
    privilegedUserCount,
    privilegedUsersWithoutPasskeyCount,
    currentUserPasskeyCount,
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

function createPrivilegedUserWhere(tenantId: string): Prisma.UserWhereInput {
  return {
    tenantId,
    OR: [
      {
        isSystemAdmin: true,
      },
      {
        memberships: {
          some: {
            status: MembershipStatus.ACTIVE,
            roleAssignments: {
              some: {
                role: {
                  permissions: {
                    some: {
                      permission: {
                        code: {
                          in: privilegedAuthenticationPermissionCodes,
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
  };
}

export const prismaAuthPolicyRepository = {
  assertAuthPolicyAllowsLogin,
  getAuthPolicy,
  updateAuthPolicy,
};
