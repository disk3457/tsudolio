export function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

export function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

export function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    timeZone: timezone,
  }).format(new Date(value));
}

export function formatFullDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(new Date(value));
}

export function formatDue(value: string | null, timezone: string) {
  if (value === null) {
    return "期限なし";
  }

  return formatDateTime(value, timezone);
}

export function getPriorityMeta(priority: string) {
  if (priority === "URGENT" || priority === "HIGH") {
    return { label: "重要", level: "high" };
  }

  if (priority === "NORMAL" || priority === "MEDIUM") {
    return { label: "通常", level: "medium" };
  }

  return { label: "低", level: "low" };
}

export function getSeverityMeta(severity: string) {
  if (severity === "CRITICAL") {
    return { label: "緊急", level: "critical" };
  }

  if (severity === "WARNING") {
    return { label: "注意", level: "warning" };
  }

  if (severity === "INFO") {
    return { label: "情報", level: "info" };
  }

  return { label: "通知", level: "notice" };
}
