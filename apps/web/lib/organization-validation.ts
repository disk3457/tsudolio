import { OrganizationDataError } from "@/lib/organization-data";
import type {
  OrganizationUnitInput,
  OrganizationUnitKind,
  UserInput,
} from "@/lib/organization-types";

const organizationUnitKinds = new Set([
  "DEPARTMENT",
  "WARD",
  "BRANCH",
  "TEAM",
  "EXTERNAL_PARTNER",
]);

const organizationCodePattern = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseOrganizationUnitInput(
  body: unknown,
): OrganizationUnitInput {
  if (!isRecord(body)) {
    throw new OrganizationDataError(
      "INVALID_JSON",
      "組織データの形式が正しくありません。",
    );
  }

  const code = readRequiredText(body.code, "組織コード", 80);

  if (!organizationCodePattern.test(code)) {
    throw new OrganizationDataError(
      "INVALID_FIELD",
      "組織コードは英小文字、数字、ハイフンで入力してください。",
    );
  }

  return {
    code,
    name: readRequiredText(body.name, "組織名", 160),
    kind: readOrganizationUnitKind(body.kind),
    parentId: readOptionalId(body.parentId, "親組織"),
    sortOrder: readSortOrder(body.sortOrder),
  };
}

export function parseUserInput(body: unknown): UserInput {
  if (!isRecord(body)) {
    throw new OrganizationDataError(
      "INVALID_JSON",
      "利用者データの形式が正しくありません。",
    );
  }

  const email = readRequiredText(body.email, "メールアドレス", 254);

  if (!emailPattern.test(email)) {
    throw new OrganizationDataError(
      "INVALID_FIELD",
      "メールアドレスの形式が正しくありません。",
    );
  }

  return {
    email: email.toLowerCase(),
    displayName: readRequiredText(body.displayName, "表示名", 120),
    kanaName: readOptionalText(body.kanaName, "カナ氏名", 120),
    title: readOptionalText(body.title, "役職", 120),
    organizationUnitId: readOptionalId(body.organizationUnitId, "所属組織"),
    isSystemAdmin: readBoolean(body.isSystemAdmin),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new OrganizationDataError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  const text = value.trim();

  if (!text) {
    throw new OrganizationDataError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  if (text.length > maxLength) {
    throw new OrganizationDataError(
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
    throw new OrganizationDataError(
      "INVALID_FIELD",
      `${label}の形式が正しくありません。`,
    );
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new OrganizationDataError(
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
    throw new OrganizationDataError(
      "INVALID_FIELD",
      `${label}の形式が正しくありません。`,
    );
  }

  return value;
}

function readOrganizationUnitKind(value: unknown): OrganizationUnitKind {
  if (typeof value !== "string" || !organizationUnitKinds.has(value)) {
    throw new OrganizationDataError(
      "INVALID_FIELD",
      "組織種別の形式が正しくありません。",
    );
  }

  return value as OrganizationUnitKind;
}

function readSortOrder(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const numericValue =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw new OrganizationDataError(
      "INVALID_FIELD",
      "表示順は0以上の整数で入力してください。",
    );
  }

  return numericValue;
}

function readBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new OrganizationDataError(
      "INVALID_FIELD",
      "管理者フラグの形式が正しくありません。",
    );
  }

  return value;
}
