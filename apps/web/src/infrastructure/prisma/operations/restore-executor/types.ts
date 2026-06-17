import type {
  OperationsBackupDataKey,
  OperationsImportCandidate,
  OperationsImportValidationReport,
  OperationsRestoreCurrentBackupCheck,
  OperationsRestoreExecutionCompletedReport,
} from "@/application/operations/types";
import type { MutationContext } from "@/application/security/types";
import type {
  DocumentStatus,
  EventVisibility,
  FacilityStatus,
  MembershipStatus,
  OrganizationUnitKind,
  WorkflowPriority,
  WorkflowStatus,
} from "@generated/prisma/enums";

export const supportedOperationsRestoreDataSetKeys = [
  "permissions",
  "organizationUnits",
  "users",
  "memberships",
  "roles",
  "rolePermissions",
  "roleAssignments",
  "facilities",
  "calendarEvents",
  "facilityReservations",
  "notices",
  "noticeAcknowledgements",
  "workflowRequests",
  "documents",
] as const satisfies OperationsBackupDataKey[];

export type SupportedOperationsRestoreDataSetKey =
  (typeof supportedOperationsRestoreDataSetKeys)[number];

export type RestoreTenant = {
  code: string;
  id: string;
};

export type RestoreExecutorInput = {
  backup: OperationsImportCandidate;
  currentBackup: OperationsImportCandidate;
  currentBackupCheck: OperationsRestoreCurrentBackupCheck;
  restore: OperationsImportValidationReport;
  tenant: RestoreTenant;
};

export type ExecuteRestoreTransactionInput = RestoreExecutorInput & {
  context: MutationContext;
  report: OperationsRestoreExecutionCompletedReport;
};

export type OrganizationUnitRestoreRow = {
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

export type UserRestoreRow = {
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

export type MembershipRestoreRow = {
  id: string;
  tenantId: string;
  userId: string;
  organizationUnitId: string;
  status: MembershipStatus;
  joinedAt: Date;
  leftAt: Date | null;
};

export type RoleRestoreRow = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PermissionRestoreRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type RolePermissionRestoreRow = {
  roleId: string;
  permissionId: string;
};

export type RoleAssignmentRestoreRow = {
  id: string;
  roleId: string;
  membershipId: string;
  assignedAt: Date;
};

export type FacilityRestoreRow = {
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

export type CalendarEventRestoreRow = {
  id: string;
  tenantId: string;
  organizationUnitId: string | null;
  createdById: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  visibility: EventVisibility;
  createdAt: Date;
  updatedAt: Date;
};

export type FacilityReservationRestoreRow = {
  id: string;
  tenantId: string;
  facilityId: string;
  eventId: string | null;
  startsAt: Date;
  endsAt: Date;
  purpose: string;
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type NoticeRestoreRow = {
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

export type NoticeAcknowledgementRestoreRow = {
  id: string;
  tenantId: string;
  noticeId: string;
  userId: string;
  acknowledgedAt: Date;
};

export type WorkflowRequestRestoreRow = {
  id: string;
  tenantId: string;
  organizationUnitId: string | null;
  requesterId: string;
  title: string;
  category: string;
  description: string | null;
  status: WorkflowStatus;
  priority: WorkflowPriority;
  dueAt: Date | null;
  submittedAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentRestoreRow = {
  id: string;
  tenantId: string;
  organizationUnitId: string | null;
  uploadedById: string;
  title: string;
  category: string;
  version: string;
  status: DocumentStatus;
  storageKey: string;
  retentionUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
