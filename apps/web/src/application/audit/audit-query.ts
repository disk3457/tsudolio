import type {
  AuditEventDateRange,
  AuditEventFilterState,
  AuditEventSeverity,
} from "@/application/audit/types";

const severityValues = new Set<AuditEventSeverity>([
  "INFO",
  "NOTICE",
  "WARNING",
  "CRITICAL",
]);
const rangeValues = new Set<AuditEventDateRange>([
  "24h",
  "7d",
  "30d",
  "all",
]);

export const defaultAuditEventFilters: AuditEventFilterState = {
  query: "",
  severity: "all",
  targetType: "all",
  action: "all",
  range: "30d",
  limit: 50,
};

export function parseAuditEventQuery(
  searchParams: URLSearchParams,
): AuditEventFilterState {
  return {
    query: readText(searchParams.get("query"), 120),
    severity: readSeverity(searchParams.get("severity")),
    targetType: readOption(searchParams.get("targetType"), 120),
    action: readOption(searchParams.get("action"), 160),
    range: readRange(searchParams.get("range")),
    limit: readLimit(searchParams.get("limit")),
  };
}

function readSeverity(value: string | null): AuditEventFilterState["severity"] {
  if (value && severityValues.has(value as AuditEventSeverity)) {
    return value as AuditEventSeverity;
  }

  return defaultAuditEventFilters.severity;
}

function readRange(value: string | null): AuditEventDateRange {
  if (value && rangeValues.has(value as AuditEventDateRange)) {
    return value as AuditEventDateRange;
  }

  return defaultAuditEventFilters.range;
}

function readLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return defaultAuditEventFilters.limit;
  }

  return Math.min(Math.max(parsed, 25), 100);
}

function readOption(value: string | null, maxLength: number) {
  const text = readText(value, maxLength);

  return text || "all";
}

function readText(value: string | null, maxLength: number) {
  if (!value) {
    return "";
  }

  return value.trim().slice(0, maxLength);
}
