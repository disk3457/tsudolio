import type {
  OperationHardeningStatus,
  OperationHealthStatus,
  OperationImportIssue,
  OperationImportTableStatus,
  OperationMetric,
  OperationRestorePlanStep,
  OperationsImportValidationReport,
} from "@/application/operations/types";

export function getHealthLabel(status: OperationHealthStatus) {
  if (status === "OK") {
    return "OK";
  }

  if (status === "CRITICAL") {
    return "要対応";
  }

  return "確認";
}

export function getHardeningStatusMeta(status: OperationHardeningStatus) {
  if (status === "OK") {
    return {
      label: "OK",
      level: "ok",
    };
  }

  if (status === "ACTION_REQUIRED") {
    return {
      label: "要対応",
      level: "action-required",
    };
  }

  return {
    label: "確認",
    level: "attention",
  };
}

export function getImportStatusMeta(
  status: OperationsImportValidationReport["status"],
) {
  if (status === "READY") {
    return {
      label: "検査OK",
      level: "ready",
    };
  }

  if (status === "WARNING") {
    return {
      label: "注意あり",
      level: "warning",
    };
  }

  return {
    label: "ブロック",
    level: "blocked",
  };
}

export function getImportIssueMeta(
  severity: OperationImportIssue["severity"],
) {
  if (severity === "ERROR") {
    return {
      label: "ERROR",
      level: "error",
    };
  }

  if (severity === "WARNING") {
    return {
      label: "WARN",
      level: "warning",
    };
  }

  return {
    label: "INFO",
    level: "info",
  };
}

export function getImportTableStatusLabel(
  status: OperationImportTableStatus,
) {
  if (status === "MATCH") {
    return "一致";
  }

  if (status === "MISSING") {
    return "不足";
  }

  return "差分";
}

export function getRestorePlanPhaseLabel(
  phase: OperationRestorePlanStep["phase"],
) {
  if (phase === "PRECHECK") {
    return "検査";
  }

  if (phase === "PREPARE") {
    return "準備";
  }

  if (phase === "VERIFY") {
    return "検証";
  }

  return "復元";
}

export function getRestorePlanActionLabel(
  action: OperationRestorePlanStep["action"],
) {
  if (action === "REPLACE") {
    return "置換";
  }

  if (action === "REVIEW") {
    return "確認";
  }

  if (action === "SKIP") {
    return "保持";
  }

  return "反映";
}

export function getRestorePlanStepStatusMeta(
  status: OperationRestorePlanStep["status"],
) {
  if (status === "READY") {
    return {
      label: "OK",
      level: "ready",
    };
  }

  if (status === "BLOCKED") {
    return {
      label: "停止",
      level: "blocked",
    };
  }

  return {
    label: "確認",
    level: "review",
  };
}

export function createLoadingMetrics(): OperationMetric[] {
  return [
    "identity",
    "permissions",
    "facilities",
    "workflow",
    "content",
    "audit",
  ].map((key) => ({
    detail: "取得中",
    key,
    label: "読み込み中",
    tone: "neutral",
    unit: "件",
    value: 0,
  }));
}
