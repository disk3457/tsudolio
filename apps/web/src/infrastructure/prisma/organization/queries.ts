import { OrganizationApplicationError } from "@/application/organization/errors";
import type {
  MembershipSummary,
  OrganizationSnapshot,
  OrganizationUnitSummary,
  UserSummary,
} from "@/application/organization/types";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { getTenantOrThrow } from "@/infrastructure/prisma/organization/common";
import {
  MembershipStatus,
  OrganizationUnitKind,
} from "@generated/prisma/enums";

export async function getOrganizationSnapshot(
  tenantCode: string,
): Promise<OrganizationSnapshot> {
  const tenant = await getTenantOrThrow(tenantCode);
  const [organizationUnits, users, roles] = await Promise.all([
    findOrganizationUnits(tenant.id),
    findUsers(tenant.id),
    prisma.role.findMany({
      where: { tenantId: tenant.id },
      include: {
        permissions: true,
        assignments: {
          where: {
            membership: {
              status: MembershipStatus.ACTIVE,
            },
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    tenant: {
      code: tenant.code,
      name: tenant.displayName ?? tenant.name,
      timezone: tenant.timezone,
    },
    organizationUnits: organizationUnits.map(mapOrganizationUnit),
    users: users.map(mapUser),
    roles: roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      assignmentCount: role.assignments.length,
      permissionCount: role.permissions.length,
    })),
  };
}

export async function getOrganizationUnitSummary(
  tenantId: string,
  unitId: string,
): Promise<OrganizationUnitSummary> {
  const unit = await prisma.organizationUnit.findFirst({
    where: {
      id: unitId,
      tenantId,
    },
    include: {
      parent: true,
      children: {
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      memberships: {
        select: {
          id: true,
          status: true,
        },
      },
      facilities: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!unit) {
    throw new OrganizationApplicationError(
      "ORGANIZATION_UNIT_NOT_FOUND",
      "指定された組織が見つかりません。",
      404,
    );
  }

  return mapOrganizationUnit(unit);
}

export async function getUserSummary(
  tenantId: string,
  userId: string,
): Promise<UserSummary> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId,
    },
    include: {
      credential: {
        select: {
          id: true,
        },
      },
      memberships: {
        include: {
          organizationUnit: true,
          roleAssignments: {
            include: {
              role: true,
            },
          },
        },
        orderBy: {
          joinedAt: "asc",
        },
      },
    },
  });

  if (!user) {
    throw new OrganizationApplicationError(
      "USER_NOT_FOUND",
      "指定された利用者が見つかりません。",
      404,
    );
  }

  return mapUser(user);
}

async function findOrganizationUnits(tenantId: string) {
  return prisma.organizationUnit.findMany({
    where: { tenantId },
    include: {
      parent: true,
      children: {
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      memberships: {
        select: {
          id: true,
          status: true,
        },
      },
      facilities: {
        select: {
          id: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

async function findUsers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
    include: {
      credential: {
        select: {
          id: true,
        },
      },
      memberships: {
        include: {
          organizationUnit: true,
          roleAssignments: {
            include: {
              role: true,
            },
          },
        },
        orderBy: {
          joinedAt: "asc",
        },
      },
    },
    orderBy: { displayName: "asc" },
  });
}

type OrganizationUnitRecord = Awaited<
  ReturnType<typeof findOrganizationUnits>
>[number];
type UserRecord = Awaited<ReturnType<typeof findUsers>>[number];

function mapOrganizationUnit(
  unit: OrganizationUnitRecord,
): OrganizationUnitSummary {
  const activeMemberCount = unit.memberships.filter(
    (membership) => membership.status === MembershipStatus.ACTIVE,
  ).length;

  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    kind: unit.kind,
    kindLabel: getOrganizationKindLabel(unit.kind),
    parentId: unit.parentId,
    parentName: unit.parent?.name ?? null,
    path: unit.path,
    sortOrder: unit.sortOrder,
    memberCount: unit.memberships.length,
    activeMemberCount,
    childCount: unit.children.length,
    facilityCount: unit.facilities.length,
    children: unit.children,
  };
}

function mapUser(user: UserRecord): UserSummary {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    kanaName: user.kanaName,
    title: user.title,
    isSystemAdmin: user.isSystemAdmin,
    passwordLoginEnabled: Boolean(user.credential),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    memberships: user.memberships.map(mapMembership),
  };
}

function mapMembership(
  membership: UserRecord["memberships"][number],
): MembershipSummary {
  return {
    id: membership.id,
    organizationUnitId: membership.organizationUnitId,
    organizationUnitName: membership.organizationUnit.name,
    status: membership.status,
    statusLabel: getMembershipStatusLabel(membership.status),
    roleIds: membership.roleAssignments.map((assignment) => assignment.role.id),
    roleNames: membership.roleAssignments.map((assignment) => assignment.role.name),
  };
}

function getOrganizationKindLabel(kind: string) {
  const labels: Record<string, string> = {
    [OrganizationUnitKind.DEPARTMENT]: "部署",
    [OrganizationUnitKind.WARD]: "病棟",
    [OrganizationUnitKind.BRANCH]: "支店",
    [OrganizationUnitKind.TEAM]: "チーム",
    [OrganizationUnitKind.EXTERNAL_PARTNER]: "外部連携",
  };

  return labels[kind] ?? kind;
}

function getMembershipStatusLabel(status: string) {
  const labels: Record<string, string> = {
    [MembershipStatus.ACTIVE]: "有効",
    [MembershipStatus.INVITED]: "招待中",
    [MembershipStatus.SUSPENDED]: "停止中",
    [MembershipStatus.LEFT]: "退職/離任",
  };

  return labels[status] ?? status;
}
