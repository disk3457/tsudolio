import { prisma } from "@/lib/prisma";
import type {
  MembershipSummary,
  OrganizationSnapshot,
  OrganizationUnitInput,
  OrganizationUnitSummary,
  UserInput,
  UserSummary,
} from "@/features/organization/types";
import type { Prisma } from "@/generated/prisma/client";
import {
  MembershipStatus,
  OrganizationUnitKind,
} from "@/generated/prisma/enums";

const defaultTenantCode = "demo-city-hospital";

export class OrganizationDataError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "OrganizationDataError";
  }
}

export async function getOrganizationSnapshot(
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
): Promise<OrganizationSnapshot> {
  const tenant = await getTenantOrThrow(tenantCode);
  const [organizationUnits, users, roles] = await Promise.all([
    findOrganizationUnits(tenant.id),
    findUsers(tenant.id),
    prisma.role.findMany({
      where: { tenantId: tenant.id },
      include: {
        permissions: true,
        assignments: true,
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

export async function createOrganizationUnit(
  input: OrganizationUnitInput,
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
): Promise<OrganizationUnitSummary> {
  const tenant = await getTenantOrThrow(tenantCode);

  const unitId = await prisma.$transaction(async (tx) => {
    const parent = await getParentUnit(tx, tenant.id, input.parentId);

    const unit = await tx.organizationUnit.create({
      data: {
        tenantId: tenant.id,
        parentId: parent?.id ?? null,
        code: input.code,
        name: input.name,
        kind: input.kind,
        path: buildUnitPath(parent?.path ?? null, input.name),
        sortOrder: input.sortOrder,
      },
      select: {
        id: true,
      },
    });

    return unit.id;
  });

  return getOrganizationUnitSummary(tenant.id, unitId);
}

export async function updateOrganizationUnit(
  unitId: string,
  input: OrganizationUnitInput,
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
): Promise<OrganizationUnitSummary> {
  const tenant = await getTenantOrThrow(tenantCode);

  const updatedUnitId = await prisma.$transaction(async (tx) => {
    const existingUnit = await tx.organizationUnit.findFirst({
      where: {
        id: unitId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        path: true,
      },
    });

    if (!existingUnit) {
      throw new OrganizationDataError(
        "ORGANIZATION_UNIT_NOT_FOUND",
        "指定された組織が見つかりません。",
        404,
      );
    }

    if (input.parentId === unitId) {
      throw new OrganizationDataError(
        "INVALID_PARENT",
        "自分自身を親組織にはできません。",
      );
    }

    const parent = await getParentUnit(tx, tenant.id, input.parentId);

    if (
      parent &&
      (parent.path === existingUnit.path ||
        parent.path.startsWith(`${existingUnit.path}/`))
    ) {
      throw new OrganizationDataError(
        "INVALID_PARENT",
        "配下の組織を親組織にはできません。",
      );
    }

    await tx.organizationUnit.update({
      where: { id: unitId },
      data: {
        parentId: parent?.id ?? null,
        code: input.code,
        name: input.name,
        kind: input.kind,
        path: buildUnitPath(parent?.path ?? null, input.name),
        sortOrder: input.sortOrder,
      },
    });

    await refreshDescendantPaths(tx, tenant.id, unitId);

    return unitId;
  });

  return getOrganizationUnitSummary(tenant.id, updatedUnitId);
}

export async function deleteOrganizationUnit(
  unitId: string,
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
) {
  const tenant = await getTenantOrThrow(tenantCode);

  await prisma.$transaction(async (tx) => {
    const unit = await tx.organizationUnit.findFirst({
      where: {
        id: unitId,
        tenantId: tenant.id,
      },
      include: {
        children: {
          select: { id: true },
          take: 1,
        },
        memberships: {
          select: { id: true },
          take: 1,
        },
        facilities: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!unit) {
      throw new OrganizationDataError(
        "ORGANIZATION_UNIT_NOT_FOUND",
        "指定された組織が見つかりません。",
        404,
      );
    }

    if (unit.children.length > 0) {
      throw new OrganizationDataError(
        "ORGANIZATION_UNIT_HAS_CHILDREN",
        "配下組織があるため削除できません。",
        409,
      );
    }

    if (unit.memberships.length > 0 || unit.facilities.length > 0) {
      throw new OrganizationDataError(
        "ORGANIZATION_UNIT_IN_USE",
        "所属利用者または施設があるため削除できません。",
        409,
      );
    }

    await tx.organizationUnit.delete({
      where: { id: unitId },
    });
  });
}

export async function createUser(
  input: UserInput,
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
): Promise<UserSummary> {
  const tenant = await getTenantOrThrow(tenantCode);

  const userId = await prisma.$transaction(async (tx) => {
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

    if (input.organizationUnitId) {
      await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          organizationUnitId: input.organizationUnitId,
          status: MembershipStatus.ACTIVE,
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
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
): Promise<UserSummary> {
  const tenant = await getTenantOrThrow(tenantCode);

  const updatedUserId = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findFirst({
      where: {
        id: userId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
      },
    });

    if (!existingUser) {
      throw new OrganizationDataError(
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

    return userId;
  });

  return getUserSummary(tenant.id, updatedUserId);
}

export async function deleteOrSuspendUser(
  userId: string,
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
) {
  const tenant = await getTenantOrThrow(tenantCode);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        id: userId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new OrganizationDataError(
        "USER_NOT_FOUND",
        "指定された利用者が見つかりません。",
        404,
      );
    }

    const blockingReferenceCount = await countUserReferences(tx, tenant.id, userId);

    if (blockingReferenceCount === 0) {
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

    return {
      id: userId,
      deleted: false,
      suspended: true,
    };
  });
}

async function getTenantOrThrow(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new OrganizationDataError(
      "TENANT_NOT_FOUND",
      `テナントが見つかりません: ${tenantCode}`,
      404,
    );
  }

  return tenant;
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

async function getOrganizationUnitSummary(
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
    throw new OrganizationDataError(
      "ORGANIZATION_UNIT_NOT_FOUND",
      "指定された組織が見つかりません。",
      404,
    );
  }

  return mapOrganizationUnit(unit);
}

async function getUserSummary(
  tenantId: string,
  userId: string,
): Promise<UserSummary> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId,
    },
    include: {
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
    throw new OrganizationDataError(
      "USER_NOT_FOUND",
      "指定された利用者が見つかりません。",
      404,
    );
  }

  return mapUser(user);
}

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
    roleNames: membership.roleAssignments.map((assignment) => assignment.role.name),
  };
}

async function getParentUnit(
  tx: Prisma.TransactionClient,
  tenantId: string,
  parentId: string | null,
) {
  if (!parentId) {
    return null;
  }

  const parent = await tx.organizationUnit.findFirst({
    where: {
      id: parentId,
      tenantId,
    },
    select: {
      id: true,
      path: true,
    },
  });

  if (!parent) {
    throw new OrganizationDataError(
      "PARENT_ORGANIZATION_UNIT_NOT_FOUND",
      "指定された親組織が見つかりません。",
      404,
    );
  }

  return parent;
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
    throw new OrganizationDataError(
      "ORGANIZATION_UNIT_NOT_FOUND",
      "指定された組織が見つかりません。",
      404,
    );
  }
}

async function refreshDescendantPaths(
  tx: Prisma.TransactionClient,
  tenantId: string,
  parentId: string,
) {
  const parent = await tx.organizationUnit.findFirst({
    where: {
      id: parentId,
      tenantId,
    },
    select: {
      path: true,
      children: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!parent) {
    return;
  }

  for (const child of parent.children) {
    await tx.organizationUnit.update({
      where: { id: child.id },
      data: {
        path: buildUnitPath(parent.path, child.name),
      },
    });
    await refreshDescendantPaths(tx, tenantId, child.id);
  }
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

function buildUnitPath(parentPath: string | null, name: string) {
  return parentPath ? `${parentPath}/${name}` : `/${name}`;
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
