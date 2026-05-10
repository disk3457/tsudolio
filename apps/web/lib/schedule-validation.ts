import { ScheduleDataError } from "@/lib/schedule-data";
import type {
  ScheduleEventInput,
  ScheduleRange,
} from "@/lib/schedule-types";

const visibilityValues = new Set(["PRIVATE", "ORGANIZATION", "TENANT"]);

export function parseScheduleRange(value: string | null): ScheduleRange {
  if (value === "today" || value === "week" || value === "month") {
    return value;
  }

  return "week";
}

export function parseScheduleEventInput(body: unknown): ScheduleEventInput {
  if (!isRecord(body)) {
    throw new ScheduleDataError(
      "INVALID_JSON",
      "予定データの形式が正しくありません。",
    );
  }

  const title = readRequiredText(body.title, "件名", 200);
  const startsAt = readDate(body.startsAt, "開始日時");
  const endsAt = readDate(body.endsAt, "終了日時");

  if (endsAt <= startsAt) {
    throw new ScheduleDataError(
      "INVALID_DATE_RANGE",
      "終了日時は開始日時より後にしてください。",
    );
  }

  const visibility = readVisibility(body.visibility);

  return {
    title,
    description: readOptionalText(body.description, "説明", 4000),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    location: readOptionalText(body.location, "場所", 200),
    visibility,
    organizationUnitId: readOptionalId(body.organizationUnitId, "組織"),
    facilityId: readOptionalId(body.facilityId, "施設"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new ScheduleDataError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  const text = value.trim();

  if (!text) {
    throw new ScheduleDataError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  if (text.length > maxLength) {
    throw new ScheduleDataError(
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
    throw new ScheduleDataError(
      "INVALID_FIELD",
      `${label}の形式が正しくありません。`,
    );
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new ScheduleDataError(
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
    throw new ScheduleDataError(
      "INVALID_FIELD",
      `${label}の形式が正しくありません。`,
    );
  }

  return value;
}

function readDate(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ScheduleDataError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ScheduleDataError(
      "INVALID_FIELD",
      `${label}の形式が正しくありません。`,
    );
  }

  return date;
}

function readVisibility(value: unknown): ScheduleEventInput["visibility"] {
  if (value === undefined || value === null || value === "") {
    return "ORGANIZATION";
  }

  if (typeof value !== "string" || !visibilityValues.has(value)) {
    throw new ScheduleDataError(
      "INVALID_FIELD",
      "公開範囲の形式が正しくありません。",
    );
  }

  return value as ScheduleEventInput["visibility"];
}
