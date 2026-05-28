export type AuditEventSeverity = "INFO" | "NOTICE" | "WARNING" | "CRITICAL";

export type AuditEventDateRange = "24h" | "7d" | "30d" | "all";

export const auditLogRetentionDayOptions = [90, 180, 365, 1095, 2555] as const;

export const defaultAuditLogRetentionDays = 365;

export type AuditLogRetentionDays =
  (typeof auditLogRetentionDayOptions)[number];

export type AuditEventFilterState = {
  query: string;
  severity: AuditEventSeverity | "all";
  targetType: string;
  action: string;
  range: AuditEventDateRange;
  limit: number;
};

export type AuditEventSummary = {
  id: string;
  createdAt: string;
  action: string;
  severity: AuditEventSeverity;
  targetType: string;
  targetId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  actor: {
    id: string;
    email: string;
    displayName: string;
  } | null;
};

export type AuditEventSnapshot = {
  tenant: {
    code: string;
    name: string;
    timezone: string;
    auditLogRetentionDays: AuditLogRetentionDays;
  };
  events: AuditEventSummary[];
  total: number;
  retainedSince: string;
  filterOptions: {
    actions: string[];
    targetTypes: string[];
  };
  filters: AuditEventFilterState;
};

export type AuditEventExportSnapshot = AuditEventSnapshot & {
  exportLimit: number;
  exportedAt: string;
  filename: string;
  truncated: boolean;
};

export type AuditEventApiResponse =
  | {
      data: AuditEventSnapshot;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type AuditRetentionPolicy = {
  retentionDays: AuditLogRetentionDays;
  retainedSince: string;
  totalEventCount: number;
  retainedEventCount: number;
  expiredEventCount: number;
  oldestEventAt: string | null;
  newestEventAt: string | null;
  updatedAt: string;
};

export type AuditRetentionApiResponse =
  | {
      data: AuditRetentionPolicy;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type AuditEventLoadState = {
  snapshot: AuditEventSnapshot | null;
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

export type AuditRetentionLoadState = {
  snapshot: AuditRetentionPolicy | null;
  status: "loading" | "ready" | "saving" | "error";
  message: string | null;
  updatedAt: string | null;
};
