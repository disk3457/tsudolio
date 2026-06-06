import { WorkflowApplicationError } from "@/application/workflows/errors";
import type {
  WorkflowDecisionInput,
  WorkflowPriorityValue,
  WorkflowRequestInput,
} from "@/application/workflows/types";

const decisionStatuses = ["APPROVED", "REJECTED", "RETURNED"] as const;
const workflowPriorities = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);
const workflowActions = new Set(["DRAFT", "SUBMIT"]);

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

export function parseWorkflowRequestInput(value: unknown): WorkflowRequestInput {
  if (!isRecord(value)) {
    throw new WorkflowApplicationError(
      "INVALID_WORKFLOW_REQUEST",
      "申請データの形式が正しくありません。",
    );
  }

  return {
    title: readRequiredText(value.title, "件名", 220),
    category: readRequiredText(value.category, "分類", 120),
    description: readOptionalText(value.description, "申請内容", 4000),
    organizationUnitId: readOptionalId(value.organizationUnitId, "申請組織"),
    priority: readPriority(value.priority),
    dueAt: readOptionalDateTime(value.dueAt, "期限"),
    action: readAction(value.action),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new WorkflowApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  const text = value.trim();

  if (!text) {
    throw new WorkflowApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  if (text.length > maxLength) {
    throw new WorkflowApplicationError(
      "INVALID_FIELD",
      `${label}は${maxLength}文字以内で入力してください。`,
    );
  }

  return text;
}

function readOptionalText(
  value: unknown,
  label: string,
  maxLength: number,
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new WorkflowApplicationError(
      "INVALID_FIELD",
      `${label}の形式が正しくありません。`,
    );
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new WorkflowApplicationError(
      "INVALID_FIELD",
      `${label}は${maxLength}文字以内で入力してください。`,
    );
  }

  return text;
}

function readOptionalId(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new WorkflowApplicationError(
      "INVALID_FIELD",
      `${label}の指定が正しくありません。`,
    );
  }

  const text = value.trim();

  return text || null;
}

function readOptionalDateTime(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new WorkflowApplicationError(
      "INVALID_FIELD",
      `${label}の日時形式が正しくありません。`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new WorkflowApplicationError(
      "INVALID_FIELD",
      `${label}の日時形式が正しくありません。`,
    );
  }

  return date.toISOString();
}

function readPriority(value: unknown): WorkflowPriorityValue {
  if (typeof value !== "string" || !workflowPriorities.has(value)) {
    throw new WorkflowApplicationError(
      "INVALID_FIELD",
      "優先度の指定が正しくありません。",
    );
  }

  return value as WorkflowPriorityValue;
}

function readAction(value: unknown): WorkflowRequestInput["action"] {
  if (typeof value !== "string" || !workflowActions.has(value)) {
    throw new WorkflowApplicationError(
      "INVALID_FIELD",
      "申請の保存方法が正しくありません。",
    );
  }

  return value as WorkflowRequestInput["action"];
}
