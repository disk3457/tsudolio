import { ApplicationError } from "@/application/shared/application-error";
import {
  auditLogRetentionDayOptions,
  type AuditLogRetentionDays,
} from "@/application/audit/types";

export type AuditRetentionPolicyInput = {
  retentionDays: AuditLogRetentionDays;
};

export function parseAuditRetentionPolicyInput(
  body: unknown,
): AuditRetentionPolicyInput {
  if (!body || typeof body !== "object") {
    return invalidAuditRetentionPolicyInput();
  }

  const values = body as {
    retentionDays?: unknown;
  };

  if (!isAuditLogRetentionDays(values.retentionDays)) {
    return invalidAuditRetentionPolicyInput();
  }

  return {
    retentionDays: values.retentionDays,
  };
}

export function isAuditLogRetentionDays(
  value: unknown,
): value is AuditLogRetentionDays {
  return auditLogRetentionDayOptions.includes(value as AuditLogRetentionDays);
}

function invalidAuditRetentionPolicyInput(): never {
  throw new ApplicationError(
    "AUDIT_RETENTION_INPUT_INVALID",
    "監査ログ保持期間の指定が正しくありません。",
    400,
  );
}
