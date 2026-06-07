import type {
  OperationsSnapshot,
  TenantProfileInput,
} from "@/application/operations/types";
import type { MutationContext } from "@/application/security/types";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import { buildOperationsSnapshot } from "@/infrastructure/prisma/operations/snapshot";
import {
  getTenantByCodeOrThrow,
  mapTenantProfile,
} from "@/infrastructure/prisma/operations/tenant";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { AuditSeverity, type TenantType } from "@generated/prisma/enums";

export async function updateTenantProfile(
  input: TenantProfileInput,
  context: MutationContext,
): Promise<OperationsSnapshot> {
  const tenant = await getTenantByCodeOrThrow(context.tenantCode);
  const before = mapTenantProfile(tenant);
  const hasChanges =
    before.name !== input.name ||
    before.displayName !== input.displayName ||
    before.type !== input.type ||
    before.timezone !== input.timezone;

  if (hasChanges) {
    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: {
          id: tenant.id,
        },
        data: {
          displayName: input.displayName,
          name: input.name,
          timezone: input.timezone,
          type: input.type as TenantType,
        },
        select: {
          id: true,
        },
      });

      await recordAuditEvent(tx, {
        tenantId: tenant.id,
        context,
        action: "テナント基本情報を更新",
        targetType: "tenant",
        targetId: tenant.id,
        severity: AuditSeverity.NOTICE,
        metadata: {
          before: {
            displayName: before.displayName,
            name: before.name,
            timezone: before.timezone,
            type: before.type,
          },
          after: {
            displayName: input.displayName,
            name: input.name,
            timezone: input.timezone,
            type: input.type,
          },
        },
      });
    });
  }

  return buildOperationsSnapshot(context.tenantCode);
}
