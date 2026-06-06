import { OperationsApplicationError } from "@/application/operations/errors";
import {
  tenantTypeValues,
  type TenantProfileInput,
  type TenantTypeValue,
} from "@/application/operations/types";

const tenantTypes = new Set<string>(tenantTypeValues);

export function parseTenantProfileInput(body: unknown): TenantProfileInput {
  if (!isRecord(body)) {
    throw new OperationsApplicationError(
      "INVALID_JSON",
      "テナント設定データの形式が正しくありません。",
    );
  }

  const timezone = readRequiredText(body.timezone, "タイムゾーン", 80);

  if (!isValidTimeZone(timezone)) {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      "タイムゾーンの形式が正しくありません。",
    );
  }

  return {
    name: readRequiredText(body.name, "正式名称", 160),
    displayName: readOptionalText(body.displayName, "表示名", 160),
    type: readTenantType(body.type),
    timezone,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  const text = value.trim();

  if (!text) {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  if (text.length > maxLength) {
    throw new OperationsApplicationError(
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
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      `${label}の形式が正しくありません。`,
    );
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      `${label}は${maxLength}文字以内で入力してください。`,
    );
  }

  return text;
}

function readTenantType(value: unknown): TenantTypeValue {
  if (typeof value !== "string" || !tenantTypes.has(value)) {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      "テナント種別の形式が正しくありません。",
    );
  }

  return value as TenantTypeValue;
}

function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("ja-JP", { timeZone: timezone }).format(
      new Date(),
    );
    return true;
  } catch {
    return false;
  }
}
