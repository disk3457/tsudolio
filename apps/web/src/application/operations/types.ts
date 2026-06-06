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

export type OperationBackupSummary = {
  endpoint: string;
  filename: string;
  estimatedRecordCount: number;
  includes: string[];
  generatedAt: string;
};

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

export type OperationsApiResponse =
  | {
      data: OperationsSnapshot;
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
