import { ApplicationError } from "@/application/shared/application-error";

const maximumPasskeyNameLength = 120;

export type PasskeyRegistrationVerifyInput = {
  name: string | null;
  response: unknown;
};

export function parsePasskeyRegistrationOptionsInput(body: unknown) {
  if (!isRecord(body)) {
    return {
      name: null,
    };
  }

  return {
    name: readOptionalName(body.name),
  };
}

export function parsePasskeyRegistrationVerifyInput(
  body: unknown,
): PasskeyRegistrationVerifyInput {
  if (!isRecord(body)) {
    throw new ApplicationError(
      "INVALID_JSON",
      "Passkey登録データの形式が正しくありません。",
      400,
    );
  }

  if (!isRecord(body.response)) {
    throw new ApplicationError(
      "INVALID_FIELD",
      "Passkey登録レスポンスを確認できません。",
      400,
    );
  }

  return {
    name: readOptionalName(body.name),
    response: body.response,
  };
}

function readOptionalName(value: unknown) {
  if (typeof value === "undefined" || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApplicationError(
      "INVALID_FIELD",
      "Passkey名の形式が正しくありません。",
      400,
    );
  }

  const name = value.trim();

  if (!name) {
    return null;
  }

  if (name.length > maximumPasskeyNameLength) {
    throw new ApplicationError(
      "INVALID_FIELD",
      `Passkey名は${maximumPasskeyNameLength}文字以内で入力してください。`,
      400,
    );
  }

  return name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
