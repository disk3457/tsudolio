import type {
  TenantProfile,
  TenantTypeValue,
} from "@/application/operations/types";
import { ApplicationError } from "@/application/shared/application-error";
import { prisma } from "@/infrastructure/prisma/prisma-client";

export async function getTenantByCodeOrThrow(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new ApplicationError(
      "TENANT_NOT_FOUND",
      "テナントが見つかりません。",
      404,
    );
  }

  return tenant;
}

export function mapTenantProfile(tenant: {
  auditLogRetentionDays: number;
  code: string;
  createdAt: Date;
  displayName: string | null;
  name: string;
  requirePasskeyForPrivilegedUsers: boolean;
  timezone: string;
  type: string;
  updatedAt: Date;
}): TenantProfile {
  return {
    auditLogRetentionDays: tenant.auditLogRetentionDays,
    code: tenant.code,
    createdAt: tenant.createdAt.toISOString(),
    displayName: tenant.displayName,
    name: tenant.name,
    requirePasskeyForPrivilegedUsers:
      tenant.requirePasskeyForPrivilegedUsers,
    timezone: tenant.timezone,
    type: tenant.type as TenantTypeValue,
    updatedAt: tenant.updatedAt.toISOString(),
  };
}
