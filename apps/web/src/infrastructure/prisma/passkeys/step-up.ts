import { ApplicationError } from "@/application/shared/application-error";
import type { CurrentUserContext } from "@/application/security/types";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { AuditSeverity } from "@generated/prisma/enums";
import { recordAuthAuditEventInTransaction } from "@/infrastructure/prisma/audit-event-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { recordPasskeyStepUpFailure } from "@/infrastructure/prisma/passkeys/audit";
import {
  createPasskeyAuditMetadata,
  hashWebAuthnChallenge,
  invalidPasskeyStepUp,
  passkeyAuthenticationChallengeMinutes,
  readAuthenticationResponse,
  readTransports,
  resolveWebAuthnConfig,
  toWebAuthnCredential,
} from "@/infrastructure/prisma/passkeys/shared";

export async function createPasskeyStepUpOptions(input: {
  currentUser: CurrentUserContext;
  ipAddress?: string | null;
  origin?: string | null;
}) {
  const { currentUser } = input;
  const passkeys = await prisma.webAuthnCredential.findMany({
    where: {
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
    },
    select: {
      credentialId: true,
      transports: true,
    },
  });

  if (passkeys.length === 0) {
    await recordPasskeyStepUpFailure(input, "missing_credential");
    throw new ApplicationError(
      "PASSKEY_STEP_UP_NOT_CONFIGURED",
      "本人確認に使えるPasskeyが登録されていません。",
      409,
    );
  }

  const config = resolveWebAuthnConfig(input.origin);
  const options = await generateAuthenticationOptions({
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: readTransports(passkey.transports),
    })),
    rpID: config.rpID,
    userVerification: "required",
  });
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + passkeyAuthenticationChallengeMinutes * 60 * 1000,
  );

  await prisma.$transaction(async (tx) => {
    await tx.webAuthnAuthenticationChallenge.deleteMany({
      where: {
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
      },
    });
    await tx.webAuthnAuthenticationChallenge.create({
      data: {
        challengeHash: hashWebAuthnChallenge(options.challenge),
        expiresAt,
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
      },
    });
    await recordAuthAuditEventInTransaction(tx, {
      tenantId: currentUser.tenantId,
      actorId: currentUser.userId,
      action: "Step-up認証開始",
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

export async function verifyPasskeyStepUp(input: {
  currentUser: CurrentUserContext;
  response: unknown;
  ipAddress?: string | null;
  origin?: string | null;
}) {
  const { currentUser } = input;
  const response = readAuthenticationResponse(input.response);
  const activeChallenges = await prisma.webAuthnAuthenticationChallenge.findMany({
    where: {
      expiresAt: {
        gt: new Date(),
      },
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
    },
    select: {
      challengeHash: true,
    },
  });

  if (activeChallenges.length === 0) {
    await recordPasskeyStepUpFailure(input, "challenge_missing");
    throw new ApplicationError(
      "PASSKEY_STEP_UP_CHALLENGE_MISSING",
      "本人確認を最初からやり直してください。",
      400,
    );
  }

  const passkey = await prisma.webAuthnCredential.findFirst({
    where: {
      credentialId: response.id,
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
    },
    select: {
      backedUp: true,
      credentialId: true,
      deviceType: true,
      id: true,
      publicKey: true,
      signCount: true,
      transports: true,
    },
  });

  if (!passkey) {
    await recordPasskeyStepUpFailure(input, "unknown_credential", {
      credentialId: response.id,
    });
    throw invalidPasskeyStepUp();
  }

  const config = resolveWebAuthnConfig(input.origin);
  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;

  try {
    verification = await verifyAuthenticationResponse({
      credential: toWebAuthnCredential(passkey),
      expectedChallenge: (challenge) =>
        activeChallenges.some(
          (activeChallenge) =>
            activeChallenge.challengeHash === hashWebAuthnChallenge(challenge),
        ),
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      response,
    });
  } catch {
    await recordPasskeyStepUpFailure(input, "verification_failed", {
      credentialId: passkey.credentialId,
    });
    throw invalidPasskeyStepUp();
  }

  if (!verification.verified) {
    await recordPasskeyStepUpFailure(input, "verification_rejected", {
      credentialId: passkey.credentialId,
    });
    throw invalidPasskeyStepUp();
  }

  const { authenticationInfo } = verification;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.webAuthnAuthenticationChallenge.deleteMany({
      where: {
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
      },
    });
    await tx.webAuthnCredential.update({
      where: {
        id: passkey.id,
      },
      data: {
        backedUp: authenticationInfo.credentialBackedUp,
        deviceType: authenticationInfo.credentialDeviceType,
        lastUsedAt: now,
        signCount: authenticationInfo.newCounter,
      },
    });
    await recordAuthAuditEventInTransaction(tx, {
      tenantId: currentUser.tenantId,
      actorId: currentUser.userId,
      action: "Step-up認証成功",
      targetType: "user",
      targetId: currentUser.userId,
      severity: AuditSeverity.NOTICE,
      ipAddress: input.ipAddress ?? null,
      metadata: createPasskeyAuditMetadata("success", {
        credentialId: passkey.credentialId,
        origin: authenticationInfo.origin,
        rpId: authenticationInfo.rpID,
      }),
    });
  });

  return {
    verified: true,
  };
}
