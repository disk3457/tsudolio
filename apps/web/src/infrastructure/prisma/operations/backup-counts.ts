import type { OperationsBackupDataKey } from "@/application/operations/types";
import { operationsBackupDataSetDefinitions } from "@/application/operations/types";
import { prisma } from "@/infrastructure/prisma/prisma-client";

export async function getCurrentBackupTableCounts(
  tenantId: string,
): Promise<Record<OperationsBackupDataKey, number>> {
  const counts = await prisma.$transaction([
    prisma.organizationUnit.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId } }),
    prisma.membership.count({ where: { tenantId } }),
    prisma.role.count({ where: { tenantId } }),
    prisma.permission.count({
      where: {
        roles: {
          some: {
            role: {
              tenantId,
            },
          },
        },
      },
    }),
    prisma.rolePermission.count({
      where: {
        role: {
          tenantId,
        },
      },
    }),
    prisma.roleAssignment.count({
      where: {
        role: {
          tenantId,
        },
      },
    }),
    prisma.facility.count({ where: { tenantId } }),
    prisma.calendarEvent.count({ where: { tenantId } }),
    prisma.facilityReservation.count({ where: { tenantId } }),
    prisma.notice.count({ where: { tenantId } }),
    prisma.noticeAcknowledgement.count({ where: { tenantId } }),
    prisma.workflowRequest.count({ where: { tenantId } }),
    prisma.document.count({ where: { tenantId } }),
    prisma.documentVersion.count({ where: { tenantId } }),
  ]);

  return Object.fromEntries(
    operationsBackupDataSetDefinitions.map((definition, index) => [
      definition.key,
      counts[index] ?? 0,
    ]),
  ) as Record<OperationsBackupDataKey, number>;
}
