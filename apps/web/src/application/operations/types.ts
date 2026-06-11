export const tenantTypeValues = [
  "MUNICIPALITY",
  "HOSPITAL",
  "COMPANY",
  "HYBRID",
] as const;

export type TenantTypeValue = (typeof tenantTypeValues)[number];

export type TenantProfile = {
  code: string;
  name: string;
  displayName: string | null;
  type: TenantTypeValue;
  timezone: string;
  auditLogRetentionDays: number;
  requirePasskeyForPrivilegedUsers: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TenantProfileInput = {
  name: string;
  displayName: string | null;
  type: TenantTypeValue;
  timezone: string;
};

export type OperationMetricTone = "neutral" | "good" | "warning" | "danger";

export type OperationMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  detail: string;
  tone: OperationMetricTone;
};

export type OperationHealthStatus = "OK" | "WARNING" | "CRITICAL";

export type OperationHealthCheck = {
  key: string;
  label: string;
  status: OperationHealthStatus;
  value: string;
  detail: string;
  checkedAt: string;
};

export type OperationHardeningStatus =
  | "OK"
  | "ATTENTION"
  | "ACTION_REQUIRED";

export type OperationHardeningItem = {
  key: string;
  label: string;
  status: OperationHardeningStatus;
  detail: string;
  evidence: string;
};

export type OperationHardeningChecklist = {
  status: OperationHardeningStatus;
  score: number;
  completedCount: number;
  attentionCount: number;
  actionRequiredCount: number;
  totalCount: number;
  generatedAt: string;
  items: OperationHardeningItem[];
};

export type OperationBackupSummary = {
  endpoint: string;
  filename: string;
  estimatedRecordCount: number;
  includes: string[];
  generatedAt: string;
};

export const operationsBackupDataSetDefinitions = [
  { key: "organizationUnits", label: "組織単位" },
  { key: "users", label: "利用者" },
  { key: "memberships", label: "所属" },
  { key: "roles", label: "ロール" },
  { key: "permissions", label: "権限" },
  { key: "rolePermissions", label: "ロール権限" },
  { key: "roleAssignments", label: "権限割当" },
  { key: "facilities", label: "施設" },
  { key: "calendarEvents", label: "予定" },
  { key: "facilityReservations", label: "施設予約" },
  { key: "notices", label: "掲示・回覧" },
  { key: "noticeAcknowledgements", label: "既読確認" },
  { key: "workflowRequests", label: "申請" },
  { key: "documents", label: "文書" },
  { key: "documentVersions", label: "文書版履歴" },
] as const;

export type OperationsBackupDataKey =
  (typeof operationsBackupDataSetDefinitions)[number]["key"];

export type OperationAuditEventSummary = {
  id: string;
  action: string;
  severity: "INFO" | "NOTICE" | "WARNING" | "CRITICAL";
  targetType: string;
  targetId: string | null;
  actor: string | null;
  createdAt: string;
};

export type OperationsSnapshot = {
  tenant: TenantProfile;
  metrics: OperationMetric[];
  healthChecks: OperationHealthCheck[];
  hardening: OperationHardeningChecklist;
  backup: OperationBackupSummary;
  recentEvents: OperationAuditEventSummary[];
};

export type OperationsBackupSnapshot = {
  schemaVersion: 1;
  exportedAt: string;
  tenant: TenantProfile;
  counts: Record<string, number>;
  data: Record<string, unknown[]>;
};

export type OperationImportIssueSeverity = "INFO" | "WARNING" | "ERROR";

export type OperationImportIssue = {
  key: string;
  label: string;
  detail: string;
  severity: OperationImportIssueSeverity;
};

export type OperationImportValidationStatus =
  | "READY"
  | "WARNING"
  | "BLOCKED";

export type OperationImportTableStatus =
  | "MATCH"
  | "CHANGED"
  | "MISSING";

export type OperationImportTableSummary = {
  key: OperationsBackupDataKey;
  label: string;
  incomingCount: number;
  currentCount: number;
  declaredCount: number | null;
  status: OperationImportTableStatus;
};

export type OperationRestorePlanPhase =
  | "PRECHECK"
  | "PREPARE"
  | "RESTORE"
  | "VERIFY";

export type OperationRestorePlanAction =
  | "SKIP"
  | "UPSERT"
  | "REPLACE"
  | "REVIEW";

export type OperationRestorePlanStepStatus =
  | "READY"
  | "REVIEW_REQUIRED"
  | "BLOCKED";

export type OperationRestorePlanStep = {
  key: string;
  phase: OperationRestorePlanPhase;
  label: string;
  detail: string;
  action: OperationRestorePlanAction;
  status: OperationRestorePlanStepStatus;
  tableKey: OperationsBackupDataKey | null;
  recordCount: number;
};

export type OperationRestorePlan = {
  status: OperationImportValidationStatus;
  summary: string;
  canRestore: boolean;
  destructive: boolean;
  estimatedRecordCount: number;
  blockedReason: string | null;
  steps: OperationRestorePlanStep[];
};

export type OperationsImportCandidate = {
  schemaVersion: number | null;
  exportedAt: string | null;
  tenant: {
    code: string | null;
    name: string | null;
    displayName: string | null;
    timezone: string | null;
    type: TenantTypeValue | null;
  };
  counts: Record<string, number>;
  data: Record<string, unknown[]>;
  unknownDataKeys: string[];
  validationIssues: OperationImportIssue[];
};

export type OperationsImportValidationReport = {
  status: OperationImportValidationStatus;
  generatedAt: string;
  schemaVersion: number | null;
  exportedAt: string | null;
  tenant: OperationsImportCandidate["tenant"];
  currentTenant: {
    code: string;
    name: string;
  };
  totalIncomingRecords: number;
  totalCurrentRecords: number;
  issues: OperationImportIssue[];
  tables: OperationImportTableSummary[];
  restorePlan: OperationRestorePlan;
};

export type OperationsRestoreDryRunInput = {
  mode: "DRY_RUN";
  confirmationToken: string;
  backup: OperationsImportCandidate;
  currentBackup: OperationsImportCandidate;
};

export type OperationsRestoreCurrentBackupCheck = {
  exportedAt: string | null;
  status: OperationImportValidationStatus;
  totalRecords: number;
  matchesCurrentState: boolean;
  issues: OperationImportIssue[];
};

export type OperationsRestoreDryRunReport = {
  mode: "DRY_RUN";
  dryRun: true;
  generatedAt: string;
  canProceed: boolean;
  restore: OperationsImportValidationReport;
  currentBackup: OperationsRestoreCurrentBackupCheck;
  guardrails: {
    confirmationTokenAccepted: true;
    currentBackupRequired: true;
    currentBackupMatchesCurrentState: boolean;
    destructiveRestoreBlocked: true;
  };
};

export type OperationsApiResponse =
  | {
      data: OperationsSnapshot;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type OperationsImportValidationApiResponse =
  | {
      data: OperationsImportValidationReport;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type OperationsRestoreDryRunApiResponse =
  | {
      data: OperationsRestoreDryRunReport;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type OperationsLoadState = {
  snapshot: OperationsSnapshot | null;
  status: "loading" | "ready" | "saving" | "error";
  message: string | null;
  updatedAt: string | null;
};
