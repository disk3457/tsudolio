import { OrganizationApplicationError } from "@/application/organization/errors";
import type { Prisma } from "@generated/prisma/client";
import { MembershipStatus } from "@generated/prisma/enums";

export type UserMembershipRoleSyncResult = {
  previousRoleIds: string[];
  roleIds: string[];
  changed: boolean;
};

export async function syncUserMembershipAndRoles(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  organizationUnitId: string | null,
  roleIds: string[],
): Promise<UserMembershipRoleSyncResult> {
  if (!organizationUnitId && roleIds.length > 0) {
    throw new OrganizationApplicationError(
      "INVALID_FIELD",
      "ロールを割り当てる場合は所属組織を選択してください。",
    );
  }

  const validatedRoleIds = await assertRolesBelongToTenant(tx, tenantId, roleIds);
  const currentMemberships = await tx.membership.findMany({
    where: {
      tenantId,
      userId,
    },
    select: {
      id: true,
      status: true,
      roleAssignments: {
        select: {
          roleId: true,
        },
      },
    },
  });
  const previousRoleIds = sortUnique(
    currentMemberships
      .filter((membership) => membership.status === MembershipStatus.ACTIVE)
      .flatMap((membership) =>
        membership.roleAssignments.map((assignment) => assignment.roleId),
      ),
  );

  if (!organizationUnitId) {
    const membershipIds = currentMemberships.map((membership) => membership.id);

    if (membershipIds.length > 0) {
      await tx.roleAssignment.deleteMany({
        where: {
          membershipId: {
            in: membershipIds,
          },
        },
      });
      await tx.membership.updateMany({
        where: {
          id: {
            in: membershipIds,
          },
          status: {
            not: MembershipStatus.LEFT,
          },
        },
        data: {
          status: MembershipStatus.LEFT,
          leftAt: new Date(),
        },
      });
    }

    return {
      previousRoleIds,
      roleIds: [],
      changed: previousRoleIds.length > 0,
    };
  }

  const membership = await tx.membership.upsert({
    where: {
      tenantId_userId_organizationUnitId: {
        tenantId,
        userId,
        organizationUnitId,
      },
    },
    create: {
      tenantId,
      userId,
      organizationUnitId,
      status: MembershipStatus.ACTIVE,
    },
    update: {
      status: MembershipStatus.ACTIVE,
      leftAt: null,
    },
    select: {
      id: true,
    },
  });
  const inactiveMembershipIds = currentMemberships
    .filter((currentMembership) => currentMembership.id !== membership.id)
    .map((currentMembership) => currentMembership.id);

  if (inactiveMembershipIds.length > 0) {
    await tx.roleAssignment.deleteMany({
      where: {
        membershipId: {
          in: inactiveMembershipIds,
        },
      },
    });
    await tx.membership.updateMany({
      where: {
        id: {
          in: inactiveMembershipIds,
        },
        status: {
          not: MembershipStatus.LEFT,
        },
      },
      data: {
        status: MembershipStatus.LEFT,
        leftAt: new Date(),
      },
    });
  }

  await syncRoleAssignments(tx, membership.id, validatedRoleIds);

  return {
    previousRoleIds,
    roleIds: validatedRoleIds,
    changed: !hasSameStringValues(previousRoleIds, validatedRoleIds),
  };
}

async function assertRolesBelongToTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  roleIds: string[],
) {
  const uniqueRoleIds = sortUnique(roleIds);

  if (uniqueRoleIds.length === 0) {
    return [];
  }

  const roles = await tx.role.findMany({
    where: {
      tenantId,
      id: {
        in: uniqueRoleIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (roles.length !== uniqueRoleIds.length) {
    throw new OrganizationApplicationError(
      "ROLE_NOT_FOUND",
      "指定されたロールが見つかりません。",
      404,
    );
  }

  return sortUnique(roles.map((role) => role.id));
}

async function syncRoleAssignments(
  tx: Prisma.TransactionClient,
  membershipId: string,
  roleIds: string[],
) {
  await tx.roleAssignment.deleteMany({
    where:
      roleIds.length > 0
        ? {
            membershipId,
            roleId: {
              notIn: roleIds,
            },
          }
        : {
            membershipId,
          },
  });

  if (roleIds.length === 0) {
    return;
  }

  await tx.roleAssignment.createMany({
    data: roleIds.map((roleId) => ({
      roleId,
      membershipId,
    })),
    skipDuplicates: true,
  });
}

function sortUnique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function hasSameStringValues(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
