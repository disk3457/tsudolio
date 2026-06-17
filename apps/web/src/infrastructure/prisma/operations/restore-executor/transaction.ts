import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import {
  readCalendarEventRows,
  readFacilityReservationRows,
  readFacilityRows,
  readMembershipRows,
  readNoticeAcknowledgementRows,
  readNoticeRows,
  readOrganizationUnitRows,
  readPermissionRows,
  readRoleAssignmentRows,
  readRolePermissionRows,
  readRoleRows,
  readUserRows,
  sortOrganizationUnitRows,
} from "@/infrastructure/prisma/operations/restore-executor/row-readers";
import type {
  CalendarEventRestoreRow,
  ExecuteRestoreTransactionInput,
  FacilityReservationRestoreRow,
  FacilityRestoreRow,
  MembershipRestoreRow,
  NoticeAcknowledgementRestoreRow,
  NoticeRestoreRow,
  OrganizationUnitRestoreRow,
  PermissionRestoreRow,
  RoleAssignmentRestoreRow,
  RolePermissionRestoreRow,
  RoleRestoreRow,
  UserRestoreRow,
} from "@/infrastructure/prisma/operations/restore-executor/types";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";
import { AuditSeverity } from "@generated/prisma/enums";

export async function executeOperationsRestoreTransaction(
  input: ExecuteRestoreTransactionInput,
) {
  const permissions = readPermissionRows(input.backup);
  const organizationUnits = sortOrganizationUnitRows(
    readOrganizationUnitRows(input.backup, input.tenant.id),
  );
  const users = readUserRows(input.backup, input.tenant.id);
  const memberships = readMembershipRows(input.backup, input.tenant.id);
  const roles = readRoleRows(input.backup, input.tenant.id);
  const rolePermissions = readRolePermissionRows(input.backup);
  const roleAssignments = readRoleAssignmentRows(input.backup);
  const facilities = readFacilityRows(input.backup, input.tenant.id);
  const calendarEvents = readCalendarEventRows(input.backup, input.tenant.id);
  const facilityReservations = readFacilityReservationRows(
    input.backup,
    input.tenant.id,
  );
  const notices = readNoticeRows(input.backup, input.tenant.id);
  const noticeAcknowledgements = readNoticeAcknowledgementRows(
    input.backup,
    input.tenant.id,
  );

  await prisma.$transaction(async (tx) => {
    await restorePermissions(tx, permissions);
    await restoreOrganizationUnits(tx, organizationUnits);
    await restoreUsers(tx, users);
    await restoreMemberships(tx, memberships);
    await restoreRoles(tx, roles);
    await restoreRolePermissions(tx, rolePermissions);
    await restoreRoleAssignments(tx, roleAssignments);
    await restoreFacilities(tx, facilities);
    await restoreCalendarEvents(tx, calendarEvents);
    await restoreFacilityReservations(tx, facilityReservations);
    await restoreNotices(tx, notices);
    await restoreNoticeAcknowledgements(tx, noticeAcknowledgements);
    await recordAuditEvent(tx, {
      tenantId: input.tenant.id,
      context: input.context,
      action: "運用バックアップ復元の実行",
      targetType: "operations-restore",
      targetId:
        input.report.restore.tenant.code ??
        input.report.restore.currentTenant.code,
      severity: AuditSeverity.CRITICAL,
      metadata: {
        appliedDataSets: input.report.appliedDataSets.map(
          (dataSet) => dataSet.key,
        ),
        currentBackupExportedAt: input.report.currentBackup.exportedAt,
        currentBackupIssueCount: input.report.currentBackup.issues.length,
        currentBackupMatchesCurrentState:
          input.report.currentBackup.matchesCurrentState,
        destructive: input.report.restore.restorePlan.destructive,
        dryRun: false,
        executed: true,
        exportedAt: input.report.restore.exportedAt,
        guardrails: input.report.guardrails,
        issueCount: input.report.restore.issues.length,
        mode: input.report.mode,
        restorePlanStatus: input.report.restore.restorePlan.status,
        restoredRecordCount: input.report.restoredRecordCount,
        schemaVersion: input.report.restore.schemaVersion,
        status: input.report.status,
        totalIncomingRecords: input.report.restore.totalIncomingRecords,
      },
    });
  });
}

async function restorePermissions(
  tx: Prisma.TransactionClient,
  rows: PermissionRestoreRow[],
) {
  for (const row of rows) {
    await tx.permission.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
      },
      update: {
        code: row.code,
        name: row.name,
        description: row.description,
      },
    });
  }
}

async function restoreOrganizationUnits(
  tx: Prisma.TransactionClient,
  rows: OrganizationUnitRestoreRow[],
) {
  for (const row of rows) {
    await tx.organizationUnit.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenantId,
        parentId: row.parentId,
        code: row.code,
        name: row.name,
        kind: row.kind,
        path: row.path,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      update: {
        tenantId: row.tenantId,
        parentId: row.parentId,
        code: row.code,
        name: row.name,
        kind: row.kind,
        path: row.path,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  }
}

async function restoreUsers(tx: Prisma.TransactionClient, rows: UserRestoreRow[]) {
  for (const row of rows) {
    await tx.user.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenantId,
        email: row.email,
        displayName: row.displayName,
        kanaName: row.kanaName,
        title: row.title,
        locale: row.locale,
        isSystemAdmin: row.isSystemAdmin,
        lastLoginAt: row.lastLoginAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      update: {
        tenantId: row.tenantId,
        email: row.email,
        displayName: row.displayName,
        kanaName: row.kanaName,
        title: row.title,
        locale: row.locale,
        isSystemAdmin: row.isSystemAdmin,
        lastLoginAt: row.lastLoginAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  }
}

async function restoreMemberships(
  tx: Prisma.TransactionClient,
  rows: MembershipRestoreRow[],
) {
  for (const row of rows) {
    await tx.membership.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        organizationUnitId: row.organizationUnitId,
        status: row.status,
        joinedAt: row.joinedAt,
        leftAt: row.leftAt,
      },
      update: {
        tenantId: row.tenantId,
        userId: row.userId,
        organizationUnitId: row.organizationUnitId,
        status: row.status,
        joinedAt: row.joinedAt,
        leftAt: row.leftAt,
      },
    });
  }
}

async function restoreRoles(
  tx: Prisma.TransactionClient,
  rows: RoleRestoreRow[],
) {
  for (const row of rows) {
    await tx.role.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenantId,
        code: row.code,
        name: row.name,
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      update: {
        tenantId: row.tenantId,
        code: row.code,
        name: row.name,
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  }
}

async function restoreRolePermissions(
  tx: Prisma.TransactionClient,
  rows: RolePermissionRestoreRow[],
) {
  for (const row of rows) {
    await tx.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: row.roleId,
          permissionId: row.permissionId,
        },
      },
      create: {
        roleId: row.roleId,
        permissionId: row.permissionId,
      },
      update: {},
    });
  }
}

async function restoreRoleAssignments(
  tx: Prisma.TransactionClient,
  rows: RoleAssignmentRestoreRow[],
) {
  for (const row of rows) {
    await tx.roleAssignment.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        roleId: row.roleId,
        membershipId: row.membershipId,
        assignedAt: row.assignedAt,
      },
      update: {
        roleId: row.roleId,
        membershipId: row.membershipId,
        assignedAt: row.assignedAt,
      },
    });
  }
}

async function restoreFacilities(
  tx: Prisma.TransactionClient,
  rows: FacilityRestoreRow[],
) {
  for (const row of rows) {
    await tx.facility.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenantId,
        organizationUnitId: row.organizationUnitId,
        code: row.code,
        name: row.name,
        status: row.status,
        capacity: row.capacity,
        location: row.location,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      update: {
        tenantId: row.tenantId,
        organizationUnitId: row.organizationUnitId,
        code: row.code,
        name: row.name,
        status: row.status,
        capacity: row.capacity,
        location: row.location,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  }
}

async function restoreCalendarEvents(
  tx: Prisma.TransactionClient,
  rows: CalendarEventRestoreRow[],
) {
  for (const row of rows) {
    await tx.calendarEvent.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenantId,
        organizationUnitId: row.organizationUnitId,
        createdById: row.createdById,
        title: row.title,
        description: row.description,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        location: row.location,
        visibility: row.visibility,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      update: {
        tenantId: row.tenantId,
        organizationUnitId: row.organizationUnitId,
        createdById: row.createdById,
        title: row.title,
        description: row.description,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        location: row.location,
        visibility: row.visibility,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  }
}

async function restoreFacilityReservations(
  tx: Prisma.TransactionClient,
  rows: FacilityReservationRestoreRow[],
) {
  for (const row of rows) {
    await tx.facilityReservation.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenantId,
        facilityId: row.facilityId,
        eventId: row.eventId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        purpose: row.purpose,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      update: {
        tenantId: row.tenantId,
        facilityId: row.facilityId,
        eventId: row.eventId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        purpose: row.purpose,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  }
}

async function restoreNotices(
  tx: Prisma.TransactionClient,
  rows: NoticeRestoreRow[],
) {
  for (const row of rows) {
    await tx.notice.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenantId,
        organizationUnitId: row.organizationUnitId,
        title: row.title,
        body: row.body,
        requiresAck: row.requiresAck,
        publishedAt: row.publishedAt,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      update: {
        tenantId: row.tenantId,
        organizationUnitId: row.organizationUnitId,
        title: row.title,
        body: row.body,
        requiresAck: row.requiresAck,
        publishedAt: row.publishedAt,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  }
}

async function restoreNoticeAcknowledgements(
  tx: Prisma.TransactionClient,
  rows: NoticeAcknowledgementRestoreRow[],
) {
  for (const row of rows) {
    await tx.noticeAcknowledgement.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenantId,
        noticeId: row.noticeId,
        userId: row.userId,
        acknowledgedAt: row.acknowledgedAt,
      },
      update: {
        tenantId: row.tenantId,
        noticeId: row.noticeId,
        userId: row.userId,
        acknowledgedAt: row.acknowledgedAt,
      },
    });
  }
}
