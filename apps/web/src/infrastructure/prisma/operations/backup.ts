import type { OperationsBackupSnapshot } from "@/application/operations/types";
import type { CurrentUserContext } from "@/application/security/types";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import {
  getTenantByCodeOrThrow,
  mapTenantProfile,
} from "@/infrastructure/prisma/operations/tenant";

export async function getOperationsBackupSnapshot(
  currentUser: CurrentUserContext,
): Promise<OperationsBackupSnapshot> {
  const tenant = await getTenantByCodeOrThrow(currentUser.tenantCode);
  const [
    organizationUnits,
    users,
    memberships,
    roles,
    permissions,
    rolePermissions,
    roleAssignments,
    facilities,
    calendarEvents,
    facilityReservations,
    notices,
    noticeAcknowledgements,
    workflowRequests,
    documents,
    documentVersions,
  ] = await prisma.$transaction([
    prisma.organizationUnit.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { tenantId: tenant.id },
      orderBy: { displayName: "asc" },
    }),
    prisma.membership.findMany({
      where: { tenantId: tenant.id },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.role.findMany({
      where: { tenantId: tenant.id },
      orderBy: { code: "asc" },
    }),
    prisma.permission.findMany({
      where: {
        roles: {
          some: {
            role: {
              tenantId: tenant.id,
            },
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.rolePermission.findMany({
      where: {
        role: {
          tenantId: tenant.id,
        },
      },
      orderBy: [{ roleId: "asc" }, { permissionId: "asc" }],
    }),
    prisma.roleAssignment.findMany({
      where: {
        role: {
          tenantId: tenant.id,
        },
      },
      orderBy: { assignedAt: "asc" },
    }),
    prisma.facility.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { tenantId: tenant.id },
      orderBy: { startsAt: "asc" },
    }),
    prisma.facilityReservation.findMany({
      where: { tenantId: tenant.id },
      orderBy: { startsAt: "asc" },
    }),
    prisma.notice.findMany({
      where: { tenantId: tenant.id },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.noticeAcknowledgement.findMany({
      where: { tenantId: tenant.id },
      orderBy: { acknowledgedAt: "desc" },
    }),
    prisma.workflowRequest.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.documentVersion.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const data = {
    organizationUnits,
    users,
    memberships,
    roles,
    permissions,
    rolePermissions,
    roleAssignments,
    facilities,
    calendarEvents,
    facilityReservations,
    notices,
    noticeAcknowledgements,
    workflowRequests,
    documents,
    documentVersions,
  };

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    tenant: mapTenantProfile(tenant),
    counts: Object.fromEntries(
      Object.entries(data).map(([key, rows]) => [key, rows.length]),
    ),
    data,
  };
}
