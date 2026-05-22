import { ApplicationError } from "@/application/shared/application-error";

const maximumPasskeyNameLength = 120;

export type PasskeyRegistrationVerifyInput = {
  name: string | null;
  response: unknown;
};

export type PasskeyAuthenticationOptionsInput = {
  email: string;
  tenantCode: string;
};

export type PasskeyAuthenticationVerifyInput = {
  email: string;
  tenantCode: string;
  response: unknown;
};

export type PasskeyStepUpVerifyInput = {
  response: unknown;
};

export type PasskeyUpdateInput = {
  name: string;
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

export function parsePasskeyAuthenticationOptionsInput(
  body: unknown,
  defaultTenantCode?: string,
): PasskeyAuthenticationOptionsInput {
  const values = readPasskeyAuthenticationBaseInput(body, defaultTenantCode);

  return {
    email: values.email,
    tenantCode: values.tenantCode,
  };
}

export function parsePasskeyAuthenticationVerifyInput(
  body: unknown,
  defaultTenantCode?: string,
): PasskeyAuthenticationVerifyInput {
  const values = readPasskeyAuthenticationBaseInput(body, defaultTenantCode);

  if (!isRecord(values.response)) {
    throw invalidPasskeyAuthenticationInput();
  }

  return {
    email: values.email,
    response: values.response,
    tenantCode: values.tenantCode,
  };
}

export function parsePasskeyStepUpVerifyInput(
  body: unknown,
): PasskeyStepUpVerifyInput {
  if (!isRecord(body) || !isRecord(body.response)) {
    throw new ApplicationError(
      "PASSKEY_STEP_UP_INPUT_INVALID",
      "Passkey本人確認レスポンスを確認できません。",
      400,
    );
  }

  return {
    response: body.response,
  };
}

export function parsePasskeyUpdateInput(body: unknown): PasskeyUpdateInput {
  if (!isRecord(body)) {
    throw invalidPasskeyUpdateInput();
  }

  return {
    name: readRequiredName(body.name),
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

function readRequiredName(value: unknown) {
  if (typeof value !== "string") {
    throw invalidPasskeyUpdateInput();
  }

  const name = value.trim();

  if (!name) {
    throw new ApplicationError(
      "INVALID_FIELD",
      "Passkey名を入力してください。",
      400,
    );
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

function readPasskeyAuthenticationBaseInput(
  body: unknown,
  defaultTenantCode?: string,
) {
  if (!isRecord(body)) {
    throw invalidPasskeyAuthenticationInput();
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const tenantCode =
    typeof body.tenantCode === "string" && body.tenantCode.trim()
      ? body.tenantCode.trim()
      : defaultTenantCode?.trim();

  if (!tenantCode || !email) {
    throw invalidPasskeyAuthenticationInput();
  }

  return {
    email,
    response: body.response,
    tenantCode,
  };
}

function invalidPasskeyAuthenticationInput(): never {
  throw new ApplicationError(
    "PASSKEY_AUTHENTICATION_INPUT_INVALID",
    "テナントコードとメールアドレスを入力してください。",
    400,
  );
}

function invalidPasskeyUpdateInput(): never {
  throw new ApplicationError(
    "PASSKEY_UPDATE_INPUT_INVALID",
    "Passkey名を確認できません。",
    400,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
