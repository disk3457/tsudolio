import { ApplicationError } from "@/application/shared/application-error";
import type {
  CurrentUserContext,
  PasskeySummary,
} from "@/application/security/types";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { AuditSeverity } from "@generated/prisma/enums";
import { recordAuthAuditEventInTransaction } from "@/infrastructure/prisma/audit-event-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { recordPasskeyRegistrationFailure } from "@/infrastructure/prisma/passkeys/audit";
import {
  createPasskeyAuditMetadata,
  hashWebAuthnChallenge,
  invalidPasskeyRegistration,
  normalizePasskeyName,
  passkeyRegistrationChallengeMinutes,
  passkeySummarySelect,
  readRegistrationResponse,
  readTransports,
  resolveRelyingPartyName,
  resolveWebAuthnConfig,
  toPasskeySummary,
} from "@/infrastructure/prisma/passkeys/shared";

export async function createPasskeyRegistrationOptions(input: {
  currentUser: CurrentUserContext;
  ipAddress?: string | null;
  origin?: string | null;
}) {
  const { currentUser } = input;
  const config = resolveWebAuthnConfig(input.origin);
  const existingPasskeys = await prisma.webAuthnCredential.findMany({
    where: {
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
    },
    select: {
      credentialId: true,
      transports: true,
    },
  });
  const options = await generateRegistrationOptions({
    rpID: config.rpID,
    rpName: resolveRelyingPartyName(currentUser),
    userDisplayName: currentUser.displayName,
    userID: Buffer.from(currentUser.userId, "utf8"),
    userName: currentUser.email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: existingPasskeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: readTransports(passkey.transports),
    })),
  });
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + passkeyRegistrationChallengeMinutes * 60 * 1000,
  );

  await prisma.$transaction(async (tx) => {
    await tx.webAuthnRegistrationChallenge.deleteMany({
      where: {
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
      },
    });
    await tx.webAuthnRegistrationChallenge.create({
      data: {
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
        challengeHash: hashWebAuthnChallenge(options.challenge),
        expiresAt,
      },
    });
    await recordAuthAuditEventInTransaction(tx, {
      tenantId: currentUser.tenantId,
      actorId: currentUser.userId,
      action: "Passkey登録開始",
      targetType: "user",
      targetId: currentUser.userId,
      severity: AuditSeverity.INFO,
      ipAddress: input.ipAddress ?? null,
      metadata: createPasskeyAuditMetadata("challenge_issued", {
        expiresAt: expiresAt.toISOString(),
        rpId: config.rpID,
      }),
    });
  });

  return {
    options,
  };
}

export async function verifyPasskeyRegistration(input: {
  currentUser: CurrentUserContext;
  name?: string | null;
  response: unknown;
  ipAddress?: string | null;
  origin?: string | null;
}): Promise<{ passkey: PasskeySummary }> {
  const { currentUser } = input;
  const response = readRegistrationResponse(input.response);
  const config = resolveWebAuthnConfig(input.origin);
  const activeChallenges = await prisma.webAuthnRegistrationChallenge.findMany({
    where: {
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      challengeHash: true,
    },
  });

  if (activeChallenges.length === 0) {
    await recordPasskeyRegistrationFailure(input, "challenge_missing");
    throw new ApplicationError(
      "PASSKEY_REGISTRATION_CHALLENGE_MISSING",
      "Passkey登録を最初からやり直してください。",
      400,
    );
  }

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;

  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: (challenge) =>
        activeChallenges.some(
          (activeChallenge) =>
            activeChallenge.challengeHash === hashWebAuthnChallenge(challenge),
        ),
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
    });
  } catch {
    await recordPasskeyRegistrationFailure(input, "verification_failed");
    throw invalidPasskeyRegistration();
  }

  if (!verification.verified || !verification.registrationInfo) {
    await recordPasskeyRegistrationFailure(input, "verification_rejected");
    throw invalidPasskeyRegistration();
  }

  const { credential, credentialBackedUp, credentialDeviceType } =
    verification.registrationInfo;
  const duplicateCredential = await prisma.webAuthnCredential.findFirst({
    where: {
      tenantId: currentUser.tenantId,
      credentialId: credential.id,
    },
    select: {
      id: true,
    },
  });

  if (duplicateCredential) {
    await recordPasskeyRegistrationFailure(input, "duplicate_credential", {
      credentialId: credential.id,
    });
    throw new ApplicationError(
      "PASSKEY_ALREADY_REGISTERED",
      "このPasskeyは既に登録されています。",
      409,
    );
  }

  const transports = readTransports(response.response.transports ?? []);
  const passkey = await prisma.$transaction(async (tx) => {
    await tx.webAuthnRegistrationChallenge.deleteMany({
      where: {
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
      },
    });
    const createdPasskey = await tx.webAuthnCredential.create({
      data: {
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        signCount: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports,
        name: normalizePasskeyName(input.name),
      },
      select: passkeySummarySelect,
    });

    await recordAuthAuditEventInTransaction(tx, {
      tenantId: currentUser.tenantId,
      actorId: currentUser.userId,
      action: "Passkey登録",
      targetType: "webauthn_credential",
      targetId: createdPasskey.id,
      severity: AuditSeverity.WARNING,
      ipAddress: input.ipAddress ?? null,
      metadata: createPasskeyAuditMetadata("registered", {
        backedUp: credentialBackedUp,
        credentialId: credential.id,
        deviceType: credentialDeviceType,
        transports,
      }),
    });

    return createdPasskey;
  });

  return {
    passkey: toPasskeySummary(passkey),
  };
}
