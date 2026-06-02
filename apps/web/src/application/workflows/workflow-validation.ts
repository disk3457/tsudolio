import { WorkflowApplicationError } from "@/application/workflows/errors";
import type { WorkflowDecisionInput } from "@/application/workflows/types";

const decisionStatuses = ["APPROVED", "REJECTED", "RETURNED"] as const;

export function parseWorkflowDecisionInput(
  value: unknown,
): WorkflowDecisionInput {
  if (!isRecord(value)) {
    throw new WorkflowApplicationError(
      "INVALID_WORKFLOW_DECISION",
      "申請決裁データの形式が正しくありません。",
    );
  }

  const status = value.status;

  if (
    typeof status !== "string" ||
    !decisionStatuses.includes(status as WorkflowDecisionInput["status"])
  ) {
    throw new WorkflowApplicationError(
      "INVALID_WORKFLOW_DECISION_STATUS",
      "申請の決裁ステータスが正しくありません。",
    );
  }

  return {
    status: status as WorkflowDecisionInput["status"],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
