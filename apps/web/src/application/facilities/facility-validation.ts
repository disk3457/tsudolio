import { FacilityApplicationError } from "@/application/facilities/errors";
import type {
  FacilityInput,
  FacilityReservationDecisionInput,
  FacilityStatusValue,
} from "@/application/facilities/types";

const facilityStatusValues = new Set<FacilityStatusValue>([
  "AVAILABLE",
  "IN_USE",
  "MAINTENANCE",
  "APPROVAL_REQUIRED",
]);

const reservationDecisionValues = new Set<
  FacilityReservationDecisionInput["status"]
>(["APPROVED", "REJECTED", "CANCELED"]);

const facilityCodePattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,79}$/;

export function parseFacilityInput(body: unknown): FacilityInput {
  if (!isRecord(body)) {
    throw new FacilityApplicationError(
      "INVALID_JSON",
      "施設データの形式が正しくありません。",
    );
  }

  const code = readRequiredText(body.code, "施設コード", 80);

  if (!facilityCodePattern.test(code)) {
    throw new FacilityApplicationError(
      "INVALID_FIELD",
      "施設コードは英数字、ハイフン、アンダースコアで2文字以上入力してください。",
    );
  }

  return {
    code,
    name: readRequiredText(body.name, "施設名", 160),
    status: readFacilityStatus(body.status),
    capacity: readCapacity(body.capacity),
    location: readOptionalText(body.location, "場所", 200),
    organizationUnitId: readOptionalId(body.organizationUnitId, "管理組織"),
  };
}

export function parseFacilityReservationDecisionInput(
  body: unknown,
): FacilityReservationDecisionInput {
  if (!isRecord(body)) {
    throw new FacilityApplicationError(
      "INVALID_JSON",
      "予約ステータスの形式が正しくありません。",
    );
  }

  if (
    typeof body.status !== "string" ||
    !isReservationDecisionStatus(body.status)
  ) {
    throw new FacilityApplicationError(
      "INVALID_FIELD",
      "予約ステータスの形式が正しくありません。",
    );
  }

  return {
    status: body.status,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new FacilityApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  const text = value.trim();

  if (!text) {
    throw new FacilityApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  if (text.length > maxLength) {
    throw new FacilityApplicationError(
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
    throw new FacilityApplicationError(
      "INVALID_FIELD",
      `${label}の形式が正しくありません。`,
    );
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new FacilityApplicationError(
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
    throw new FacilityApplicationError(
      "INVALID_FIELD",
      `${label}の形式が正しくありません。`,
    );
  }

  return value;
}

function readCapacity(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = typeof value === "string" ? Number(value) : value;

  if (
    typeof numericValue !== "number" ||
    !Number.isInteger(numericValue) ||
    numericValue < 1 ||
    numericValue > 10000
  ) {
    throw new FacilityApplicationError(
      "INVALID_FIELD",
      "定員は1から10000までの整数で入力してください。",
    );
  }

  return numericValue;
}

function readFacilityStatus(value: unknown): FacilityStatusValue {
  if (typeof value !== "string" || !isFacilityStatusValue(value)) {
    throw new FacilityApplicationError(
      "INVALID_FIELD",
      "施設ステータスの形式が正しくありません。",
    );
  }

  return value;
}

function isFacilityStatusValue(value: string): value is FacilityStatusValue {
  return facilityStatusValues.has(value as FacilityStatusValue);
}

function isReservationDecisionStatus(
  value: string,
): value is FacilityReservationDecisionInput["status"] {
  return reservationDecisionValues.has(
    value as FacilityReservationDecisionInput["status"],
  );
}
