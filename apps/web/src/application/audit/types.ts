export type AuditEventSeverity = "INFO" | "NOTICE" | "WARNING" | "CRITICAL";

export type AuditEventDateRange = "24h" | "7d" | "30d" | "all";

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
  };
  events: AuditEventSummary[];
  total: number;
  filterOptions: {
    actions: string[];
    targetTypes: string[];
  };
  filters: AuditEventFilterState;
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

export type AuditEventLoadState = {
  snapshot: AuditEventSnapshot | null;
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};
