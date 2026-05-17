import { ApplicationError } from "@/application/shared/application-error";

const minimumPasswordLength = 12;
const maximumPasswordLength = 128;

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type PasswordResetRequestInput = {
  tenantCode: string;
  email: string;
};

export type PasswordResetConfirmInput = {
  tenantCode: string;
  token: string;
  newPassword: string;
};

export function parsePasswordChangeInput(body: unknown): PasswordChangeInput {
  if (!isRecord(body)) {
    throw new ApplicationError(
      "INVALID_JSON",
      "パスワード変更データの形式が正しくありません。",
      400,
    );
  }

  const currentPassword = readRequiredText(
    body.currentPassword,
    "現在のパスワード",
  );
  const newPassword = readNewPassword(
    body.newPassword,
    "新しいパスワード",
  );

  if (currentPassword === newPassword) {
    throw new ApplicationError(
      "PASSWORD_REUSE_NOT_ALLOWED",
      "新しいパスワードは現在のパスワードと異なる値にしてください。",
      400,
    );
  }

  return {
    currentPassword,
    newPassword,
  };
}

export function parsePasswordResetRequestInput(
  body: unknown,
): PasswordResetRequestInput {
  if (!isRecord(body)) {
    throw new ApplicationError(
      "INVALID_JSON",
      "パスワードリセット申請データの形式が正しくありません。",
      400,
    );
  }

  return {
    tenantCode: readRequiredText(body.tenantCode, "テナントコード").trim(),
    email: readEmail(body.email),
  };
}

export function parsePasswordResetConfirmInput(
  body: unknown,
): PasswordResetConfirmInput {
  if (!isRecord(body)) {
    throw new ApplicationError(
      "INVALID_JSON",
      "パスワードリセットデータの形式が正しくありません。",
      400,
    );
  }

  return {
    tenantCode: readRequiredText(body.tenantCode, "テナントコード").trim(),
    token: readRequiredText(body.token, "リセットトークン").trim(),
    newPassword: readNewPassword(body.newPassword, "新しいパスワード"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
      400,
    );
  }

  return value;
}

function readEmail(value: unknown) {
  const email = readRequiredText(value, "メールアドレス").trim().toLowerCase();

  if (!email.includes("@")) {
    throw new ApplicationError(
      "INVALID_FIELD",
      "メールアドレスの形式を確認してください。",
      400,
    );
  }

  return email;
}

function readNewPassword(value: unknown, label: string) {
  const password = readRequiredText(value, label);

  if (
    password.length < minimumPasswordLength ||
    password.length > maximumPasswordLength
  ) {
    throw new ApplicationError(
      "INVALID_FIELD",
      `${label}は${minimumPasswordLength}文字以上${maximumPasswordLength}文字以内で入力してください。`,
      400,
    );
  }

  return password;
}
