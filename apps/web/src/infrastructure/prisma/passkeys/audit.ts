import type { CurrentUserContext } from "@/application/security/types";
import { AuditSeverity } from "@generated/prisma/enums";
import type { Prisma } from "@generated/prisma/client";
import { recordAuthAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import { createPasskeyAuditMetadata } from "@/infrastructure/prisma/passkeys/shared";

export function recordPasskeyRegistrationFailure(
  input: {
    currentUser: CurrentUserContext;
    ipAddress?: string | null;
  },
  outcome: string,
  metadata: Prisma.InputJsonObject = {},
) {
  return recordAuthAuditEvent({
    tenantId: input.currentUser.tenantId,
    actorId: input.currentUser.userId,
    action: "Passkey登録失敗",
    targetType: "user",
    targetId: input.currentUser.userId,
    severity: AuditSeverity.WARNING,
    ipAddress: input.ipAddress ?? null,
    metadata: createPasskeyAuditMetadata(outcome, metadata),
  });
}

export function recordPasskeyAuthenticationFailure(
  input: {
    email: string;
    ipAddress?: string | null;
    tenantId: string;
    userId?: string | null;
  },
  outcome: string,
  metadata: Prisma.InputJsonObject = {},
) {
  return recordAuthAuditEvent({
    tenantId: input.tenantId,
    actorId: input.userId ?? undefined,
    action: "Passkeyログイン失敗",
    targetType: input.userId ? "user" : "auth_identity",
    targetId: input.userId ?? input.email,
    severity: AuditSeverity.WARNING,
    ipAddress: input.ipAddress ?? null,
    metadata: createPasskeyAuditMetadata(outcome, {
      email: input.email,
      ...metadata,
    }),
  });
}

export function recordPasskeyStepUpFailure(
  input: {
    currentUser: CurrentUserContext;
    ipAddress?: string | null;
  },
  outcome: string,
  metadata: Prisma.InputJsonObject = {},
) {
  return recordAuthAuditEvent({
    tenantId: input.currentUser.tenantId,
    actorId: input.currentUser.userId,
    action: "Step-up認証失敗",
    targetType: "user",
    targetId: input.currentUser.userId,
    severity: AuditSeverity.WARNING,
    ipAddress: input.ipAddress ?? null,
    metadata: createPasskeyAuditMetadata(outcome, metadata),
  });
}
