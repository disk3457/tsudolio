import type {
  OperationRestorePlanStep,
  OperationsBackupDataKey,
  OperationsImportCandidate,
  OperationsImportValidationReport,
  OperationsRestoreCurrentBackupCheck,
  OperationsRestoreExecutionCompletedReport,
} from "@/application/operations/types";
import { operationsBackupDataSetDefinitions } from "@/application/operations/types";
import { OperationsApplicationError } from "@/application/operations/errors";
import type { MutationContext } from "@/application/security/types";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";
import {
  AuditSeverity,
  type FacilityStatus,
  type OrganizationUnitKind,
} from "@generated/prisma/enums";

export const supportedOperationsRestoreDataSetKeys = [
  "permissions",
  "organizationUnits",
  "users",
  "roles",
  "rolePermissions",
  "facilities",
  "notices",
] as const satisfies OperationsBackupDataKey[];

type SupportedOperationsRestoreDataSetKey =
  (typeof supportedOperationsRestoreDataSetKeys)[number];

type RestoreTenant = {
  code: string;
  id: string;
};

type RestoreExecutorInput = {
  backup: OperationsImportCandidate;
  currentBackup: OperationsImportCandidate;
  currentBackupCheck: OperationsRestoreCurrentBackupCheck;
  restore: OperationsImportValidationReport;
  tenant: RestoreTenant;
};

type ExecuteRestoreTransactionInput = RestoreExecutorInput & {
  context: MutationContext;
  report: OperationsRestoreExecutionCompletedReport;
};

type OrganizationUnitRestoreRow = {
  id: string;
  tenantId: string;
  parentId: string | null;
  code: string;
  name: string;
  kind: OrganizationUnitKind;
  path: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type UserRestoreRow = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  kanaName: string | null;
  title: string | null;
  locale: string;
  isSystemAdmin: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type RoleRestoreRow = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PermissionRestoreRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

type RolePermissionRestoreRow = {
  roleId: string;
  permissionId: string;
};

type FacilityRestoreRow = {
  id: string;
  tenantId: string;
  organizationUnitId: string | null;
  code: string;
  name: string;
  status: FacilityStatus;
  capacity: number | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type NoticeRestoreRow = {
  id: string;
  tenantId: string;
  organizationUnitId: string | null;
  title: string;
  body: string;
  requiresAck: boolean;
  publishedAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const supportedDataSetKeySet = new Set<OperationsBackupDataKey>(
  supportedOperationsRestoreDataSetKeys,
);
const organizationUnitKinds = new Set<OrganizationUnitKind>([
  "DEPARTMENT",
  "WARD",
  "BRANCH",
  "TEAM",
  "EXTERNAL_PARTNER",
]);
const facilityStatuses = new Set<FacilityStatus>([
  "AVAILABLE",
  "IN_USE",
  "MAINTENANCE",
  "APPROVAL_REQUIRED",
]);

export function getOperationsRestoreExecutorBlockedReason(
  input: RestoreExecutorInput,
) {
  if (input.restore.status !== "READY") {
    return "復元検証ステータスが READY ではないため実復元を開始できません。";
  }

  if (input.restore.restorePlan.status !== "READY") {
    return "復元計画が READY ではないため実復元を開始できません。";
  }

  if (!input.restore.restorePlan.canRestore) {
    return (
      input.restore.restorePlan.blockedReason ??
      "復元計画にブロック項目があるため実復元を開始できません。"
    );
  }

  if (
    input.currentBackupCheck.status !== "READY" ||
    !input.currentBackupCheck.matchesCurrentState
  ) {
    return "現行バックアップが現在のデータ件数と一致しないため実復元を開始できません。";
  }

  const reviewStep = input.restore.restorePlan.steps.find(
    (step) => step.status === "REVIEW_REQUIRED",
  );

  if (reviewStep) {
    return `復元計画に確認が必要なステップがあります: ${reviewStep.label}`;
  }

  const replaceStep = input.restore.restorePlan.steps.find(
    (step) => step.action === "REPLACE",
  );

  if (replaceStep) {
    return `REPLACE が必要なデータセットはまだ実復元できません: ${replaceStep.label}`;
  }

  const unsupportedStep = input.restore.restorePlan.steps.find(
    (step) =>
      step.phase === "RESTORE" &&
      step.tableKey !== null &&
      !isRestoreDataSetSupported(step.tableKey) &&
      step.action !== "SKIP",
  );

  if (unsupportedStep) {
    return `対応済みデータセット外の復元はまだ実行できません: ${unsupportedStep.label}`;
  }

  try {
    validateSupportedRestoreRows(input);
    return getIdentitySetBlockedReason(input);
  } catch (error) {
    if (error instanceof OperationsApplicationError) {
      return error.message;
    }

    throw error;
  }
}

export function buildOperationsRestoreAppliedDataSets(
  restore: OperationsImportValidationReport,
): OperationsRestoreExecutionCompletedReport["appliedDataSets"] {
  return supportedOperationsRestoreDataSetKeys
    .map((key) => {
      const step = getRestoreStep(restore, key);

      if (!step || step.action !== "UPSERT" || step.recordCount === 0) {
        return null;
      }

      return {
        key,
        label: getDataSetLabel(key),
        recordCount: step.recordCount,
      };
    })
    .filter((dataSet) => dataSet !== null);
}

export async function executeOperationsRestoreTransaction(
  input: ExecuteRestoreTransactionInput,
) {
  const permissions = readPermissionRows(input.backup);
  const organizationUnits = sortOrganizationUnitRows(
    readOrganizationUnitRows(input.backup, input.tenant.id),
  );
  const users = readUserRows(input.backup, input.tenant.id);
  const roles = readRoleRows(input.backup, input.tenant.id);
  const rolePermissions = readRolePermissionRows(input.backup);
  const facilities = readFacilityRows(input.backup, input.tenant.id);
  const notices = readNoticeRows(input.backup, input.tenant.id);

  await prisma.$transaction(async (tx) => {
    await restorePermissions(tx, permissions);
    await restoreOrganizationUnits(tx, organizationUnits);
    await restoreUsers(tx, users);
    await restoreRoles(tx, roles);
    await restoreRolePermissions(tx, rolePermissions);
    await restoreFacilities(tx, facilities);
    await restoreNotices(tx, notices);
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

function validateSupportedRestoreRows(input: RestoreExecutorInput) {
  const permissions = readPermissionRows(input.backup);
  const permissionIds = new Set(permissions.map((permission) => permission.id));
  const organizationUnits = readOrganizationUnitRows(
    input.backup,
    input.tenant.id,
  );
  const organizationUnitIds = new Set(
    organizationUnits.map((unit) => unit.id),
  );
  const users = readUserRows(input.backup, input.tenant.id);
  const roles = readRoleRows(input.backup, input.tenant.id);
  const roleIds = new Set(roles.map((role) => role.id));
  const rolePermissions = readRolePermissionRows(input.backup);
  const facilities = readFacilityRows(input.backup, input.tenant.id);
  const notices = readNoticeRows(input.backup, input.tenant.id);

  for (const unit of organizationUnits) {
    if (unit.parentId && !organizationUnitIds.has(unit.parentId)) {
      throw createInvalidRestoreRowError(
        "organizationUnits",
        `data.organizationUnits の parentId ${unit.parentId} がバックアップ内の組織単位に存在しません。`,
      );
    }
  }

  sortOrganizationUnitRows(organizationUnits);
  assertUniqueUserEmails(users);
  assertAuthSensitiveUserFieldsUnchanged(input, users);

  for (const rolePermission of rolePermissions) {
    if (!roleIds.has(rolePermission.roleId)) {
      throw createInvalidRestoreRowError(
        "rolePermissions",
        `data.rolePermissions の roleId ${rolePermission.roleId} がバックアップ内のロールに存在しません。`,
      );
    }

    if (!permissionIds.has(rolePermission.permissionId)) {
      throw createInvalidRestoreRowError(
        "rolePermissions",
        `data.rolePermissions の permissionId ${rolePermission.permissionId} がバックアップ内の権限に存在しません。`,
      );
    }
  }

  for (const facility of facilities) {
    if (
      facility.organizationUnitId &&
      !organizationUnitIds.has(facility.organizationUnitId)
    ) {
      throw createInvalidRestoreRowError(
        "facilities",
        `data.facilities の organizationUnitId ${facility.organizationUnitId} がバックアップ内の組織単位に存在しません。`,
      );
    }
  }

  for (const notice of notices) {
    if (
      notice.organizationUnitId &&
      !organizationUnitIds.has(notice.organizationUnitId)
    ) {
      throw createInvalidRestoreRowError(
        "notices",
        `data.notices の organizationUnitId ${notice.organizationUnitId} がバックアップ内の組織単位に存在しません。`,
      );
    }
  }
}

function getIdentitySetBlockedReason(input: RestoreExecutorInput) {
  for (const key of supportedOperationsRestoreDataSetKeys) {
    const step = getRestoreStep(input.restore, key);

    if (!step || step.action !== "UPSERT" || step.recordCount === 0) {
      continue;
    }

    const table = input.restore.tables.find((candidate) => candidate.key === key);

    if (!table || table.currentCount === 0) {
      continue;
    }

    const restoreKeys = collectRestoreIdentityKeys(input.backup, key);
    const currentBackupKeys = collectRestoreIdentityKeys(input.currentBackup, key);

    if (!hasSameIdentitySet(restoreKeys, currentBackupKeys)) {
      return `${getDataSetLabel(
        key,
      )} は現行バックアップと復元バックアップのID集合が一致しないため、置換扱いとして拒否しました。`;
    }
  }

  return null;
}

function collectRestoreIdentityKeys(
  backup: OperationsImportCandidate,
  key: SupportedOperationsRestoreDataSetKey,
) {
  if (key === "rolePermissions") {
    return readRolePermissionRows(backup).map(
      (row) => `${row.roleId}:${row.permissionId}`,
    );
  }

  return getRestoreRows(backup, key).map((row, index) =>
    readRequiredString(row, "id", key, index),
  );
}

function hasSameIdentitySet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);

  return left.every((key) => rightSet.has(key));
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

function readOrganizationUnitRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): OrganizationUnitRestoreRow[] {
  return getRestoreRows(backup, "organizationUnits").map((row, index) => {
    const rowTenantId = readRequiredString(
      row,
      "tenantId",
      "organizationUnits",
      index,
    );
    assertRowTenant(rowTenantId, tenantId, "organizationUnits", index);

    return {
      id: readRequiredString(row, "id", "organizationUnits", index),
      tenantId: rowTenantId,
      parentId: readNullableString(row, "parentId", "organizationUnits", index),
      code: readRequiredString(row, "code", "organizationUnits", index),
      name: readRequiredString(row, "name", "organizationUnits", index),
      kind: readOrganizationUnitKind(row, index),
      path: readRequiredString(row, "path", "organizationUnits", index),
      sortOrder: readInteger(row, "sortOrder", "organizationUnits", index),
      createdAt: readDate(row, "createdAt", "organizationUnits", index),
      updatedAt: readDate(row, "updatedAt", "organizationUnits", index),
    };
  });
}

function readRoleRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): RoleRestoreRow[] {
  return getRestoreRows(backup, "roles").map((row, index) => {
    const rowTenantId = readRequiredString(row, "tenantId", "roles", index);
    assertRowTenant(rowTenantId, tenantId, "roles", index);

    return {
      id: readRequiredString(row, "id", "roles", index),
      tenantId: rowTenantId,
      code: readRequiredString(row, "code", "roles", index),
      name: readRequiredString(row, "name", "roles", index),
      description: readNullableString(row, "description", "roles", index),
      createdAt: readDate(row, "createdAt", "roles", index),
      updatedAt: readDate(row, "updatedAt", "roles", index),
    };
  });
}

function readUserRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): UserRestoreRow[] {
  return getRestoreRows(backup, "users").map((row, index) => {
    const rowTenantId = readRequiredString(row, "tenantId", "users", index);
    assertRowTenant(rowTenantId, tenantId, "users", index);

    return {
      id: readRequiredString(row, "id", "users", index),
      tenantId: rowTenantId,
      email: readRequiredString(row, "email", "users", index),
      displayName: readRequiredString(row, "displayName", "users", index),
      kanaName: readNullableString(row, "kanaName", "users", index),
      title: readNullableString(row, "title", "users", index),
      locale: readRequiredString(row, "locale", "users", index),
      isSystemAdmin: readBoolean(row, "isSystemAdmin", "users", index),
      lastLoginAt: readNullableDate(row, "lastLoginAt", "users", index),
      createdAt: readDate(row, "createdAt", "users", index),
      updatedAt: readDate(row, "updatedAt", "users", index),
    };
  });
}

function readPermissionRows(
  backup: OperationsImportCandidate,
): PermissionRestoreRow[] {
  return getRestoreRows(backup, "permissions").map((row, index) => ({
    id: readRequiredString(row, "id", "permissions", index),
    code: readRequiredString(row, "code", "permissions", index),
    name: readRequiredString(row, "name", "permissions", index),
    description: readNullableString(row, "description", "permissions", index),
  }));
}

function readRolePermissionRows(
  backup: OperationsImportCandidate,
): RolePermissionRestoreRow[] {
  return getRestoreRows(backup, "rolePermissions").map((row, index) => ({
    roleId: readRequiredString(row, "roleId", "rolePermissions", index),
    permissionId: readRequiredString(
      row,
      "permissionId",
      "rolePermissions",
      index,
    ),
  }));
}

function readFacilityRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): FacilityRestoreRow[] {
  return getRestoreRows(backup, "facilities").map((row, index) => {
    const rowTenantId = readRequiredString(row, "tenantId", "facilities", index);
    assertRowTenant(rowTenantId, tenantId, "facilities", index);

    return {
      id: readRequiredString(row, "id", "facilities", index),
      tenantId: rowTenantId,
      organizationUnitId: readNullableString(
        row,
        "organizationUnitId",
        "facilities",
        index,
      ),
      code: readRequiredString(row, "code", "facilities", index),
      name: readRequiredString(row, "name", "facilities", index),
      status: readFacilityStatus(row, index),
      capacity: readNullableInteger(row, "capacity", "facilities", index),
      location: readNullableString(row, "location", "facilities", index),
      createdAt: readDate(row, "createdAt", "facilities", index),
      updatedAt: readDate(row, "updatedAt", "facilities", index),
    };
  });
}

function readNoticeRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): NoticeRestoreRow[] {
  return getRestoreRows(backup, "notices").map((row, index) => {
    const rowTenantId = readRequiredString(row, "tenantId", "notices", index);
    assertRowTenant(rowTenantId, tenantId, "notices", index);

    return {
      id: readRequiredString(row, "id", "notices", index),
      tenantId: rowTenantId,
      organizationUnitId: readNullableString(
        row,
        "organizationUnitId",
        "notices",
        index,
      ),
      title: readRequiredString(row, "title", "notices", index),
      body: readRequiredString(row, "body", "notices", index),
      requiresAck: readBoolean(row, "requiresAck", "notices", index),
      publishedAt: readDate(row, "publishedAt", "notices", index),
      expiresAt: readNullableDate(row, "expiresAt", "notices", index),
      createdAt: readDate(row, "createdAt", "notices", index),
      updatedAt: readDate(row, "updatedAt", "notices", index),
    };
  });
}

function sortOrganizationUnitRows(rows: OrganizationUnitRestoreRow[]) {
  const sorted: OrganizationUnitRestoreRow[] = [];
  const remaining = new Map(rows.map((row) => [row.id, row]));

  while (remaining.size > 0) {
    let progressed = false;

    for (const row of Array.from(remaining.values())) {
      if (row.parentId && remaining.has(row.parentId)) {
        continue;
      }

      sorted.push(row);
      remaining.delete(row.id);
      progressed = true;
    }

    if (!progressed) {
      throw createInvalidRestoreRowError(
        "organizationUnits",
        "data.organizationUnits に循環した親子関係が含まれているため復元できません。",
      );
    }
  }

  return sorted;
}

function assertUniqueUserEmails(rows: UserRestoreRow[]) {
  const emails = new Set<string>();

  for (const row of rows) {
    const emailKey = row.email.toLowerCase();

    if (emails.has(emailKey)) {
      throw createInvalidRestoreRowError(
        "users",
        `data.users の email ${row.email} が重複しています。`,
      );
    }

    emails.add(emailKey);
  }
}

function assertAuthSensitiveUserFieldsUnchanged(
  input: RestoreExecutorInput,
  rows: UserRestoreRow[],
) {
  const currentUsers = new Map(
    readUserRows(input.currentBackup, input.tenant.id).map((row) => [
      row.id,
      row,
    ]),
  );

  for (const row of rows) {
    const currentUser = currentUsers.get(row.id);

    if (!currentUser) {
      continue;
    }

    if (currentUser.email !== row.email) {
      throw createInvalidRestoreRowError(
        "users",
        `data.users の email は認証識別子のため、このPRでは変更できません: ${row.id}`,
      );
    }

    if (currentUser.isSystemAdmin !== row.isSystemAdmin) {
      throw createInvalidRestoreRowError(
        "users",
        `data.users の isSystemAdmin は特権フラグのため、このPRでは変更できません: ${row.id}`,
      );
    }
  }
}

function getRestoreRows(
  backup: OperationsImportCandidate,
  key: SupportedOperationsRestoreDataSetKey,
) {
  return backup.data[key].map((row, index) => {
    if (!isRecord(row)) {
      throw createInvalidRestoreRowError(
        key,
        `data.${key}[${index}] はオブジェクトである必要があります。`,
      );
    }

    return row;
  });
}

function readRequiredString(
  row: Record<string, unknown>,
  field: string,
  dataSet: SupportedOperationsRestoreDataSetKey,
  index: number,
) {
  const value = row[field];

  if (typeof value !== "string" || !value.trim()) {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].${field} は文字列である必要があります。`,
    );
  }

  return value.trim();
}

function readNullableString(
  row: Record<string, unknown>,
  field: string,
  dataSet: SupportedOperationsRestoreDataSetKey,
  index: number,
) {
  const value = row[field];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].${field} は文字列または null である必要があります。`,
    );
  }

  return value.trim() || null;
}

function readInteger(
  row: Record<string, unknown>,
  field: string,
  dataSet: SupportedOperationsRestoreDataSetKey,
  index: number,
) {
  const value = row[field];

  if (!Number.isInteger(value)) {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].${field} は整数である必要があります。`,
    );
  }

  return value as number;
}

function readNullableInteger(
  row: Record<string, unknown>,
  field: string,
  dataSet: SupportedOperationsRestoreDataSetKey,
  index: number,
) {
  const value = row[field];

  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value)) {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].${field} は整数または null である必要があります。`,
    );
  }

  return value as number;
}

function readBoolean(
  row: Record<string, unknown>,
  field: string,
  dataSet: SupportedOperationsRestoreDataSetKey,
  index: number,
) {
  const value = row[field];

  if (typeof value !== "boolean") {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].${field} は真偽値である必要があります。`,
    );
  }

  return value;
}

function readDate(
  row: Record<string, unknown>,
  field: string,
  dataSet: SupportedOperationsRestoreDataSetKey,
  index: number,
) {
  const value = row[field];

  if (typeof value !== "string" && !(value instanceof Date)) {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].${field} は日時文字列である必要があります。`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].${field} は有効な日時である必要があります。`,
    );
  }

  return date;
}

function readNullableDate(
  row: Record<string, unknown>,
  field: string,
  dataSet: SupportedOperationsRestoreDataSetKey,
  index: number,
) {
  const value = row[field];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" && !(value instanceof Date)) {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].${field} は日時文字列または null である必要があります。`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].${field} は有効な日時である必要があります。`,
    );
  }

  return date;
}

function readOrganizationUnitKind(
  row: Record<string, unknown>,
  index: number,
): OrganizationUnitKind {
  const value = row.kind;

  if (
    typeof value !== "string" ||
    !organizationUnitKinds.has(value as OrganizationUnitKind)
  ) {
    throw createInvalidRestoreRowError(
      "organizationUnits",
      `data.organizationUnits[${index}].kind は対応している組織種別である必要があります。`,
    );
  }

  return value as OrganizationUnitKind;
}

function readFacilityStatus(
  row: Record<string, unknown>,
  index: number,
): FacilityStatus {
  const value = row.status;

  if (typeof value !== "string" || !facilityStatuses.has(value as FacilityStatus)) {
    throw createInvalidRestoreRowError(
      "facilities",
      `data.facilities[${index}].status は対応している施設ステータスである必要があります。`,
    );
  }

  return value as FacilityStatus;
}

function assertRowTenant(
  rowTenantId: string,
  tenantId: string,
  dataSet: SupportedOperationsRestoreDataSetKey,
  index: number,
) {
  if (rowTenantId === tenantId) {
    return;
  }

  throw createInvalidRestoreRowError(
    dataSet,
    `data.${dataSet}[${index}].tenantId は現在のテナントIDと一致する必要があります。`,
  );
}

function getRestoreStep(
  restore: OperationsImportValidationReport,
  key: OperationsBackupDataKey,
): OperationRestorePlanStep | undefined {
  return restore.restorePlan.steps.find((step) => step.tableKey === key);
}

function isRestoreDataSetSupported(
  key: OperationsBackupDataKey,
): key is SupportedOperationsRestoreDataSetKey {
  return supportedDataSetKeySet.has(key);
}

function getDataSetLabel(key: OperationsBackupDataKey) {
  return (
    operationsBackupDataSetDefinitions.find(
      (definition) => definition.key === key,
    )?.label ?? key
  );
}

function createInvalidRestoreRowError(
  dataSet: SupportedOperationsRestoreDataSetKey,
  message: string,
) {
  return new OperationsApplicationError(
    `RESTORE_${dataSet}_ROW_INVALID`,
    message,
    409,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
