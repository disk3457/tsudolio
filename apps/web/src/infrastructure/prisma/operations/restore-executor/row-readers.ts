import type { OperationsImportCandidate } from "@/application/operations/types";
import { createInvalidRestoreRowError } from "@/infrastructure/prisma/operations/restore-executor/errors";
import type {
  CalendarEventRestoreRow,
  DocumentRestoreRow,
  FacilityReservationRestoreRow,
  FacilityRestoreRow,
  NoticeAcknowledgementRestoreRow,
  MembershipRestoreRow,
  NoticeRestoreRow,
  OrganizationUnitRestoreRow,
  PermissionRestoreRow,
  RoleAssignmentRestoreRow,
  RolePermissionRestoreRow,
  RoleRestoreRow,
  SupportedOperationsRestoreDataSetKey,
  UserRestoreRow,
  WorkflowRequestRestoreRow,
} from "@/infrastructure/prisma/operations/restore-executor/types";
import type {
  DocumentStatus,
  EventVisibility,
  FacilityStatus,
  MembershipStatus,
  OrganizationUnitKind,
  WorkflowPriority,
  WorkflowStatus,
} from "@generated/prisma/enums";

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
const eventVisibilities = new Set<EventVisibility>([
  "PRIVATE",
  "ORGANIZATION",
  "TENANT",
]);
const membershipStatuses = new Set<MembershipStatus>([
  "ACTIVE",
  "INVITED",
  "SUSPENDED",
  "LEFT",
]);
const workflowStatuses = new Set<WorkflowStatus>([
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "CANCELED",
]);
const workflowPriorities = new Set<WorkflowPriority>([
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);
const documentStatuses = new Set<DocumentStatus>([
  "DRAFT",
  "REVIEW",
  "ACTIVE",
  "ARCHIVED",
]);

export function readPermissionRows(
  backup: OperationsImportCandidate,
): PermissionRestoreRow[] {
  return getRestoreRows(backup, "permissions").map((row, index) => ({
    id: readRequiredString(row, "id", "permissions", index),
    code: readRequiredString(row, "code", "permissions", index),
    name: readRequiredString(row, "name", "permissions", index),
    description: readNullableString(row, "description", "permissions", index),
  }));
}

export function readOrganizationUnitRows(
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

export function readUserRows(
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

export function readMembershipRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): MembershipRestoreRow[] {
  return getRestoreRows(backup, "memberships").map((row, index) => {
    const rowTenantId = readRequiredString(row, "tenantId", "memberships", index);
    assertRowTenant(rowTenantId, tenantId, "memberships", index);

    return {
      id: readRequiredString(row, "id", "memberships", index),
      tenantId: rowTenantId,
      userId: readRequiredString(row, "userId", "memberships", index),
      organizationUnitId: readRequiredString(
        row,
        "organizationUnitId",
        "memberships",
        index,
      ),
      status: readMembershipStatus(row, index),
      joinedAt: readDate(row, "joinedAt", "memberships", index),
      leftAt: readNullableDate(row, "leftAt", "memberships", index),
    };
  });
}

export function readRoleRows(
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

export function readRolePermissionRows(
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

export function readRoleAssignmentRows(
  backup: OperationsImportCandidate,
): RoleAssignmentRestoreRow[] {
  return getRestoreRows(backup, "roleAssignments").map((row, index) => ({
    id: readRequiredString(row, "id", "roleAssignments", index),
    roleId: readRequiredString(row, "roleId", "roleAssignments", index),
    membershipId: readRequiredString(
      row,
      "membershipId",
      "roleAssignments",
      index,
    ),
    assignedAt: readDate(row, "assignedAt", "roleAssignments", index),
  }));
}

export function readFacilityRows(
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

export function readNoticeRows(
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

export function readCalendarEventRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): CalendarEventRestoreRow[] {
  return getRestoreRows(backup, "calendarEvents").map((row, index) => {
    const rowTenantId = readRequiredString(
      row,
      "tenantId",
      "calendarEvents",
      index,
    );
    assertRowTenant(rowTenantId, tenantId, "calendarEvents", index);

    return {
      id: readRequiredString(row, "id", "calendarEvents", index),
      tenantId: rowTenantId,
      organizationUnitId: readNullableString(
        row,
        "organizationUnitId",
        "calendarEvents",
        index,
      ),
      createdById: readRequiredString(
        row,
        "createdById",
        "calendarEvents",
        index,
      ),
      title: readRequiredString(row, "title", "calendarEvents", index),
      description: readNullableString(
        row,
        "description",
        "calendarEvents",
        index,
      ),
      startsAt: readDate(row, "startsAt", "calendarEvents", index),
      endsAt: readDate(row, "endsAt", "calendarEvents", index),
      location: readNullableString(row, "location", "calendarEvents", index),
      visibility: readEventVisibility(row, index),
      createdAt: readDate(row, "createdAt", "calendarEvents", index),
      updatedAt: readDate(row, "updatedAt", "calendarEvents", index),
    };
  });
}

export function readFacilityReservationRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): FacilityReservationRestoreRow[] {
  return getRestoreRows(backup, "facilityReservations").map((row, index) => {
    const rowTenantId = readRequiredString(
      row,
      "tenantId",
      "facilityReservations",
      index,
    );
    assertRowTenant(rowTenantId, tenantId, "facilityReservations", index);

    return {
      id: readRequiredString(row, "id", "facilityReservations", index),
      tenantId: rowTenantId,
      facilityId: readRequiredString(
        row,
        "facilityId",
        "facilityReservations",
        index,
      ),
      eventId: readNullableString(
        row,
        "eventId",
        "facilityReservations",
        index,
      ),
      startsAt: readDate(row, "startsAt", "facilityReservations", index),
      endsAt: readDate(row, "endsAt", "facilityReservations", index),
      purpose: readRequiredString(row, "purpose", "facilityReservations", index),
      status: readWorkflowStatus(row, index, "facilityReservations"),
      createdAt: readDate(row, "createdAt", "facilityReservations", index),
      updatedAt: readDate(row, "updatedAt", "facilityReservations", index),
    };
  });
}

export function readNoticeAcknowledgementRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): NoticeAcknowledgementRestoreRow[] {
  return getRestoreRows(backup, "noticeAcknowledgements").map((row, index) => {
    const rowTenantId = readRequiredString(
      row,
      "tenantId",
      "noticeAcknowledgements",
      index,
    );
    assertRowTenant(rowTenantId, tenantId, "noticeAcknowledgements", index);

    return {
      id: readRequiredString(row, "id", "noticeAcknowledgements", index),
      tenantId: rowTenantId,
      noticeId: readRequiredString(
        row,
        "noticeId",
        "noticeAcknowledgements",
        index,
      ),
      userId: readRequiredString(
        row,
        "userId",
        "noticeAcknowledgements",
        index,
      ),
      acknowledgedAt: readDate(
        row,
        "acknowledgedAt",
        "noticeAcknowledgements",
        index,
      ),
    };
  });
}

export function readWorkflowRequestRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): WorkflowRequestRestoreRow[] {
  return getRestoreRows(backup, "workflowRequests").map((row, index) => {
    const rowTenantId = readRequiredString(
      row,
      "tenantId",
      "workflowRequests",
      index,
    );
    assertRowTenant(rowTenantId, tenantId, "workflowRequests", index);

    return {
      id: readRequiredString(row, "id", "workflowRequests", index),
      tenantId: rowTenantId,
      organizationUnitId: readNullableString(
        row,
        "organizationUnitId",
        "workflowRequests",
        index,
      ),
      requesterId: readRequiredString(
        row,
        "requesterId",
        "workflowRequests",
        index,
      ),
      title: readRequiredString(row, "title", "workflowRequests", index),
      category: readRequiredString(row, "category", "workflowRequests", index),
      description: readNullableString(
        row,
        "description",
        "workflowRequests",
        index,
      ),
      status: readWorkflowStatus(row, index, "workflowRequests"),
      priority: readWorkflowPriority(row, index),
      dueAt: readNullableDate(row, "dueAt", "workflowRequests", index),
      submittedAt: readNullableDate(
        row,
        "submittedAt",
        "workflowRequests",
        index,
      ),
      decidedAt: readNullableDate(row, "decidedAt", "workflowRequests", index),
      createdAt: readDate(row, "createdAt", "workflowRequests", index),
      updatedAt: readDate(row, "updatedAt", "workflowRequests", index),
    };
  });
}

export function readDocumentRows(
  backup: OperationsImportCandidate,
  tenantId: string,
): DocumentRestoreRow[] {
  return getRestoreRows(backup, "documents").map((row, index) => {
    const rowTenantId = readRequiredString(row, "tenantId", "documents", index);
    assertRowTenant(rowTenantId, tenantId, "documents", index);

    return {
      id: readRequiredString(row, "id", "documents", index),
      tenantId: rowTenantId,
      organizationUnitId: readNullableString(
        row,
        "organizationUnitId",
        "documents",
        index,
      ),
      uploadedById: readRequiredString(row, "uploadedById", "documents", index),
      title: readRequiredString(row, "title", "documents", index),
      category: readRequiredString(row, "category", "documents", index),
      version: readRequiredString(row, "version", "documents", index),
      status: readDocumentStatus(row, index, "documents"),
      storageKey: readRequiredString(row, "storageKey", "documents", index),
      retentionUntil: readNullableDate(
        row,
        "retentionUntil",
        "documents",
        index,
      ),
      createdAt: readDate(row, "createdAt", "documents", index),
      updatedAt: readDate(row, "updatedAt", "documents", index),
    };
  });
}

export function sortOrganizationUnitRows(rows: OrganizationUnitRestoreRow[]) {
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

export function collectRestoreIdentityKeys(
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

function readEventVisibility(
  row: Record<string, unknown>,
  index: number,
): EventVisibility {
  const value = row.visibility;

  if (
    typeof value !== "string" ||
    !eventVisibilities.has(value as EventVisibility)
  ) {
    throw createInvalidRestoreRowError(
      "calendarEvents",
      `data.calendarEvents[${index}].visibility は対応している公開範囲である必要があります。`,
    );
  }

  return value as EventVisibility;
}

function readMembershipStatus(
  row: Record<string, unknown>,
  index: number,
): MembershipStatus {
  const value = row.status;

  if (
    typeof value !== "string" ||
    !membershipStatuses.has(value as MembershipStatus)
  ) {
    throw createInvalidRestoreRowError(
      "memberships",
      `data.memberships[${index}].status は対応している所属ステータスである必要があります。`,
    );
  }

  return value as MembershipStatus;
}

function readWorkflowStatus(
  row: Record<string, unknown>,
  index: number,
  dataSet: SupportedOperationsRestoreDataSetKey,
): WorkflowStatus {
  const value = row.status;

  if (typeof value !== "string" || !workflowStatuses.has(value as WorkflowStatus)) {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].status は対応しているワークフローステータスである必要があります。`,
    );
  }

  return value as WorkflowStatus;
}

function readWorkflowPriority(
  row: Record<string, unknown>,
  index: number,
): WorkflowPriority {
  const value = row.priority;

  if (
    typeof value !== "string" ||
    !workflowPriorities.has(value as WorkflowPriority)
  ) {
    throw createInvalidRestoreRowError(
      "workflowRequests",
      `data.workflowRequests[${index}].priority は対応している優先度である必要があります。`,
    );
  }

  return value as WorkflowPriority;
}

function readDocumentStatus(
  row: Record<string, unknown>,
  index: number,
  dataSet: SupportedOperationsRestoreDataSetKey,
): DocumentStatus {
  const value = row.status;

  if (typeof value !== "string" || !documentStatuses.has(value as DocumentStatus)) {
    throw createInvalidRestoreRowError(
      dataSet,
      `data.${dataSet}[${index}].status は対応している文書ステータスである必要があります。`,
    );
  }

  return value as DocumentStatus;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
