import type {
  AuditEventExportSnapshot,
  AuditEventSummary,
} from "@/application/audit/types";

const csvColumns: Array<{
  header: string;
  value: (event: AuditEventSummary) => string | number | null;
}> = [
  { header: "id", value: (event) => event.id },
  { header: "created_at", value: (event) => event.createdAt },
  { header: "severity", value: (event) => event.severity },
  { header: "action", value: (event) => event.action },
  { header: "target_type", value: (event) => event.targetType },
  { header: "target_id", value: (event) => event.targetId },
  { header: "actor_id", value: (event) => event.actor?.id ?? null },
  { header: "actor_email", value: (event) => event.actor?.email ?? null },
  {
    header: "actor_display_name",
    value: (event) => event.actor?.displayName ?? null,
  },
  { header: "ip_address", value: (event) => event.ipAddress },
  { header: "metadata", value: (event) => formatMetadata(event.metadata) },
];

export function formatAuditEventsCsv(snapshot: AuditEventExportSnapshot) {
  const rows = [
    csvColumns.map((column) => column.header),
    ...snapshot.events.map((event) =>
      csvColumns.map((column) => column.value(event)),
    ),
  ];

  return `\uFEFF${rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\r\n")}\r\n`;
}

function escapeCsvValue(value: string | number | null) {
  if (value === null) {
    return "";
  }

  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function formatMetadata(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}
