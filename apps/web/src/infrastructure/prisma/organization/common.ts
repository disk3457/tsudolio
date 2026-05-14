import { OrganizationApplicationError } from "@/application/organization/errors";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";

export const defaultTenantCode = "demo-city-hospital";

export async function getTenantOrThrow(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new OrganizationApplicationError(
      "TENANT_NOT_FOUND",
      `テナントが見つかりません: ${tenantCode}`,
      404,
    );
  }

  return tenant;
}

export async function assertUserBelongsToTenant(
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
    throw new OrganizationApplicationError(
      "ACTOR_NOT_FOUND",
      "組織を操作する利用者が見つかりません。",
      404,
    );
  }
}

export async function assertOrganizationBelongsToTenant(
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
    throw new OrganizationApplicationError(
      "ORGANIZATION_UNIT_NOT_FOUND",
      "指定された組織が見つかりません。",
      404,
    );
  }
}
