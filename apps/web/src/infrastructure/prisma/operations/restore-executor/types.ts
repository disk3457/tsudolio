import type {
  OperationsBackupDataKey,
  OperationsImportCandidate,
  OperationsImportValidationReport,
  OperationsRestoreCurrentBackupCheck,
  OperationsRestoreExecutionCompletedReport,
} from "@/application/operations/types";
import type { MutationContext } from "@/application/security/types";
import type {
  FacilityStatus,
  MembershipStatus,
  OrganizationUnitKind,
} from "@generated/prisma/enums";

export const supportedOperationsRestoreDataSetKeys = [
  "permissions",
  "organizationUnits",
  "users",
  "memberships",
  "roles",
  "rolePermissions",
  "facilities",
  "notices",
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
