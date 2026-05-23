import { ApplicationError } from "@/application/shared/application-error";
import type {
  CurrentUserContext,
  PasskeySummary,
} from "@/application/security/types";
import { AuditSeverity } from "@generated/prisma/enums";
import { recordAuthAuditEventInTransaction } from "@/infrastructure/prisma/audit-event-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import {
  createPasskeyAuditMetadata,
  passkeySummarySelect,
  toPasskeySummary,
} from "@/infrastructure/prisma/passkeys/shared";

export async function deletePasskey(input: {
  currentUser: CurrentUserContext;
  passkeyId: string;
  ipAddress?: string | null;
}) {
  const passkey = await prisma.webAuthnCredential.findFirst({
    where: {
      id: input.passkeyId,
      tenantId: input.currentUser.tenantId,
      userId: input.currentUser.userId,
    },
    select: {
      credentialId: true,
      id: true,
    },
  });

  if (!passkey) {
    throw passkeyNotFound();
  }

  await prisma.$transaction(async (tx) => {
    await tx.webAuthnCredential.delete({
      where: {
        id: passkey.id,
      },
    });
    await recordAuthAuditEventInTransaction(tx, {
      tenantId: input.currentUser.tenantId,
      actorId: input.currentUser.userId,
      action: "Passkey削除",
      targetType: "webauthn_credential",
      targetId: passkey.id,
      severity: AuditSeverity.WARNING,
      ipAddress: input.ipAddress ?? null,
      metadata: createPasskeyAuditMetadata("deleted", {
        credentialId: passkey.credentialId,
      }),
    });
  });

  return {
    deleted: true,
  };
}

export async function updatePasskey(input: {
  currentUser: CurrentUserContext;
  passkeyId: string;
  name: string;
  ipAddress?: string | null;
}): Promise<{ passkey: PasskeySummary }> {
  const passkey = await prisma.webAuthnCredential.findFirst({
    where: {
      id: input.passkeyId,
      tenantId: input.currentUser.tenantId,
      userId: input.currentUser.userId,
    },
    select: {
      ...passkeySummarySelect,
      credentialId: true,
    },
  });

  if (!passkey) {
    throw passkeyNotFound();
  }

  const nextName = input.name.trim();

  if (passkey.name === nextName) {
    return {
      passkey: toPasskeySummary(passkey),
    };
  }

  const updatedPasskey = await prisma.$transaction(async (tx) => {
    const updated = await tx.webAuthnCredential.update({
      where: {
        id: passkey.id,
      },
      data: {
        name: nextName,
      },
      select: passkeySummarySelect,
    });

    await recordAuthAuditEventInTransaction(tx, {
      tenantId: input.currentUser.tenantId,
      actorId: input.currentUser.userId,
      action: "Passkey名変更",
      targetType: "webauthn_credential",
      targetId: passkey.id,
      severity: AuditSeverity.INFO,
      ipAddress: input.ipAddress ?? null,
      metadata: createPasskeyAuditMetadata("renamed", {
        credentialId: passkey.credentialId,
        newName: nextName,
        previousName: passkey.name,
      }),
    });

    return updated;
  });

  return {
    passkey: toPasskeySummary(updatedPasskey),
  };
}

function passkeyNotFound() {
  return new ApplicationError(
    "PASSKEY_NOT_FOUND",
    "Passkeyが見つかりません。",
    404,
  );
}
