import { ApplicationError } from "@/application/shared/application-error";

export type RecoveryCodeLoginInput = {
  tenantCode: string;
  email: string;
  code: string;
};

export function parseRecoveryCodeLoginInput(
  body: unknown,
  defaultTenantCode?: string,
): RecoveryCodeLoginInput {
  if (!isRecord(body)) {
    throw invalidRecoveryCodeLoginInput();
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const tenantCode =
    typeof body.tenantCode === "string" && body.tenantCode.trim()
      ? body.tenantCode.trim()
      : defaultTenantCode?.trim();

  if (!tenantCode || !email || !code) {
    throw invalidRecoveryCodeLoginInput();
  }

  return {
    code,
    email,
    tenantCode,
  };
}

function invalidRecoveryCodeLoginInput(): never {
  throw new ApplicationError(
    "RECOVERY_CODE_LOGIN_INPUT_INVALID",
    "テナントコード、メールアドレス、リカバリーコードを入力してください。",
    400,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
