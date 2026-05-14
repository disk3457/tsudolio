import { OrganizationApplicationError } from "@/application/organization/errors";
import type {
  OrganizationUnitInput,
  OrganizationUnitSummary,
} from "@/application/organization/types";
import type { MutationContext } from "@/application/security/types";
import {
  buildOrganizationUnitPath,
  isSameOrDescendantPath,
} from "@/domain/organization/organization-tree";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import {
  assertUserBelongsToTenant,
  getTenantOrThrow,
} from "@/infrastructure/prisma/organization/common";
import { getOrganizationUnitSummary } from "@/infrastructure/prisma/organization/queries";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";
import { AuditSeverity } from "@generated/prisma/enums";

export async function createOrganizationUnit(
  input: OrganizationUnitInput,
  context: MutationContext,
): Promise<OrganizationUnitSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);

  const unitId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    const parent = await getParentUnit(tx, tenant.id, input.parentId);

    const unit = await tx.organizationUnit.create({
      data: {
        tenantId: tenant.id,
        parentId: parent?.id ?? null,
        code: input.code,
        name: input.name,
        kind: input.kind,
        path: buildOrganizationUnitPath(parent?.path ?? null, input.name),
        sortOrder: input.sortOrder,
      },
      select: {
        id: true,
      },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "組織を作成",
      targetType: "organization_unit",
      targetId: unit.id,
      severity: AuditSeverity.NOTICE,
      metadata: {
        code: input.code,
        name: input.name,
        kind: input.kind,
        parentId: parent?.id ?? null,
      },
    });

    return unit.id;
  });

  return getOrganizationUnitSummary(tenant.id, unitId);
}

export async function updateOrganizationUnit(
  unitId: string,
  input: OrganizationUnitInput,
  context: MutationContext,
): Promise<OrganizationUnitSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);

  const updatedUnitId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
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
      throw new OrganizationApplicationError(
        "ORGANIZATION_UNIT_NOT_FOUND",
        "指定された組織が見つかりません。",
        404,
      );
    }

    if (input.parentId === unitId) {
      throw new OrganizationApplicationError(
        "INVALID_PARENT",
        "自分自身を親組織にはできません。",
      );
    }

    const parent = await getParentUnit(tx, tenant.id, input.parentId);

    if (parent && isSameOrDescendantPath(parent.path, existingUnit.path)) {
      throw new OrganizationApplicationError(
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
        path: buildOrganizationUnitPath(parent?.path ?? null, input.name),
        sortOrder: input.sortOrder,
      },
    });

    await refreshDescendantPaths(tx, tenant.id, unitId);

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "組織を更新",
      targetType: "organization_unit",
      targetId: unitId,
      severity: AuditSeverity.NOTICE,
      metadata: {
        code: input.code,
        name: input.name,
        kind: input.kind,
        parentId: parent?.id ?? null,
      },
    });

    return unitId;
  });

  return getOrganizationUnitSummary(tenant.id, updatedUnitId);
}

export async function deleteOrganizationUnit(
  unitId: string,
  context: MutationContext,
) {
  const tenant = await getTenantOrThrow(context.tenantCode);

  await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
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
      throw new OrganizationApplicationError(
        "ORGANIZATION_UNIT_NOT_FOUND",
        "指定された組織が見つかりません。",
        404,
      );
    }

    if (unit.children.length > 0) {
      throw new OrganizationApplicationError(
        "ORGANIZATION_UNIT_HAS_CHILDREN",
        "配下組織があるため削除できません。",
        409,
      );
    }

    if (unit.memberships.length > 0 || unit.facilities.length > 0) {
      throw new OrganizationApplicationError(
        "ORGANIZATION_UNIT_IN_USE",
        "所属利用者または施設があるため削除できません。",
        409,
      );
    }

    await tx.organizationUnit.delete({
      where: { id: unitId },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "組織を削除",
      targetType: "organization_unit",
      targetId: unitId,
      severity: AuditSeverity.WARNING,
      metadata: {
        code: unit.code,
        name: unit.name,
        kind: unit.kind,
        parentId: unit.parentId,
      },
    });
  });
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
    throw new OrganizationApplicationError(
      "PARENT_ORGANIZATION_UNIT_NOT_FOUND",
      "指定された親組織が見つかりません。",
      404,
    );
  }

  return parent;
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
        path: buildOrganizationUnitPath(parent.path, child.name),
      },
    });
    await refreshDescendantPaths(tx, tenantId, child.id);
  }
}
