import { NoticeApplicationError } from "@/application/notices/errors";
import type { NoticeInput } from "@/application/notices/types";

const maxBodyLength = 4000;

export function parseNoticeInput(body: unknown): NoticeInput {
  if (!isRecord(body)) {
    throw new NoticeApplicationError(
      "INVALID_JSON",
      "掲示データの形式が正しくありません。",
    );
  }

  const publishedAt = readRequiredDateTime(body.publishedAt, "公開日時");
  const expiresAt = readOptionalDateTime(body.expiresAt, "掲載終了");

  if (expiresAt && new Date(expiresAt).getTime() <= new Date(publishedAt).getTime()) {
    throw new NoticeApplicationError(
      "INVALID_FIELD",
      "掲載終了は公開日時より後にしてください。",
    );
  }

  return {
    title: readRequiredText(body.title, "件名", 200),
    body: readRequiredText(body.body, "本文", maxBodyLength),
    requiresAck: readBoolean(body.requiresAck, "確認必須"),
    publishedAt,
    expiresAt,
    organizationUnitId: readOptionalId(body.organizationUnitId, "対象組織"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new NoticeApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  const text = value.trim();

  if (!text) {
    throw new NoticeApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  if (text.length > maxLength) {
    throw new NoticeApplicationError(
      "INVALID_FIELD",
      `${label}は${maxLength}文字以内で入力してください。`,
    );
  }

  return text;
}

function readRequiredDateTime(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new NoticeApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  return parseDateTime(value, label);
}

function readOptionalDateTime(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new NoticeApplicationError(
      "INVALID_FIELD",
      `${label}の日時形式が正しくありません。`,
    );
  }

  return parseDateTime(value, label);
}

function parseDateTime(value: string, label: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new NoticeApplicationError(
      "INVALID_FIELD",
      `${label}の日時形式が正しくありません。`,
    );
  }

  return date.toISOString();
}

function readBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new NoticeApplicationError(
      "INVALID_FIELD",
      `${label}の指定が正しくありません。`,
    );
  }

  return value;
}

function readOptionalId(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new NoticeApplicationError(
      "INVALID_FIELD",
      `${label}の指定が正しくありません。`,
    );
  }

  const text = value.trim();
  return text || null;
}
