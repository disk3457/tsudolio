import { ApplicationError } from "@/application/shared/application-error";
import type { CurrentUserRepository } from "@/application/security/use-cases";
import type {
  CurrentUserContext,
  CurrentUserLookup,
} from "@/application/security/types";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { MembershipStatus } from "@generated/prisma/enums";

const defaultTenantCode = "demo-city-hospital";
const defaultUserEmail = "admin@example.local";

export async function resolveCurrentUser(
  lookup: CurrentUserLookup,
): Promise<CurrentUserContext> {
  const tenantCode =
    lookup.tenantCode?.trim() ||
    process.env.TSUDOLIO_TENANT_CODE ||
    defaultTenantCode;
  const userEmail =
    lookup.userEmail?.trim() ||
    process.env.TSUDOLIO_ACTOR_EMAIL ||
    defaultUserEmail;

  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
    select: {
      id: true,
      code: true,
      name: true,
      displayName: true,
    },
  });

  if (!tenant) {
    throw new ApplicationError(
      "TENANT_NOT_FOUND",
      `テナントが見つかりません: ${tenantCode}`,
      404,
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      email: userEmail,
    },
    include: {
      memberships: {
        where: {
          status: MembershipStatus.ACTIVE,
        },
        include: {
          roleAssignments: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new ApplicationError(
      "AUTHENTICATION_REQUIRED",
      "利用者を特定できません。",
      401,
    );
  }

  const permissionCodes = new Set<string>();
  const organizationUnitIds = new Set<string>();

  for (const membership of user.memberships) {
    organizationUnitIds.add(membership.organizationUnitId);

    for (const assignment of membership.roleAssignments) {
      for (const rolePermission of assignment.role.permissions) {
        permissionCodes.add(rolePermission.permission.code);
      }
    }
  }

  return {
    tenantId: tenant.id,
    tenantCode: tenant.code,
    tenantName: tenant.displayName ?? tenant.name,
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    isSystemAdmin: user.isSystemAdmin,
    organizationUnitIds: Array.from(organizationUnitIds),
    permissionCodes: Array.from(permissionCodes).sort(),
  };
}

export const prismaCurrentUserRepository = {
  resolveCurrentUser,
} satisfies CurrentUserRepository;

