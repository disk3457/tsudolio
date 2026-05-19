import { ApplicationError } from "@/application/shared/application-error";

export type AuthPolicyUpdateInput = {
  requirePasskeyForPrivilegedUsers: boolean;
};

export function parseAuthPolicyUpdateInput(
  body: unknown,
): AuthPolicyUpdateInput {
  if (!body || typeof body !== "object") {
    return invalidAuthPolicyInput();
  }

  const values = body as {
    requirePasskeyForPrivilegedUsers?: unknown;
  };

  if (typeof values.requirePasskeyForPrivilegedUsers !== "boolean") {
    return invalidAuthPolicyInput();
  }

  return {
    requirePasskeyForPrivilegedUsers:
      values.requirePasskeyForPrivilegedUsers,
  };
}

function invalidAuthPolicyInput(): never {
  throw new ApplicationError(
    "AUTH_POLICY_INPUT_INVALID",
    "認証ポリシーの指定が正しくありません。",
    400,
  );
}
