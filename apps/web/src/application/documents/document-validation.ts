import { DocumentApplicationError } from "@/application/documents/errors";
import type { DocumentInput, DocumentStatus } from "@/application/documents/types";

const documentStatuses = new Set(["DRAFT", "REVIEW", "ACTIVE", "ARCHIVED"]);

export function parseDocumentInput(body: unknown): DocumentInput {
  if (!isRecord(body)) {
    throw new DocumentApplicationError(
      "INVALID_JSON",
      "文書データの形式が正しくありません。",
    );
  }

  return {
    title: readRequiredText(body.title, "文書名", 220),
    category: readRequiredText(body.category, "分類", 120),
    version: readRequiredText(body.version, "版", 40),
    status: readDocumentStatus(body.status),
    storageKey: readRequiredText(body.storageKey, "保管キー", 500),
    retentionUntil: readOptionalDate(body.retentionUntil, "保管期限"),
    organizationUnitId: readOptionalId(body.organizationUnitId, "管理組織"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new DocumentApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  const text = value.trim();

  if (!text) {
    throw new DocumentApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  if (text.length > maxLength) {
    throw new DocumentApplicationError(
      "INVALID_FIELD",
      `${label}は${maxLength}文字以内で入力してください。`,
    );
  }

  return text;
}

function readOptionalDate(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new DocumentApplicationError(
      "INVALID_FIELD",
      `${label}の日付形式が正しくありません。`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new DocumentApplicationError(
      "INVALID_FIELD",
      `${label}の日付形式が正しくありません。`,
    );
  }

  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function readOptionalId(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new DocumentApplicationError(
      "INVALID_FIELD",
      `${label}の指定が正しくありません。`,
    );
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  return text;
}

function readDocumentStatus(value: unknown): DocumentStatus {
  if (typeof value !== "string" || !documentStatuses.has(value)) {
    throw new DocumentApplicationError(
      "INVALID_FIELD",
      "文書状態の指定が正しくありません。",
    );
  }

  return value as DocumentStatus;
}
