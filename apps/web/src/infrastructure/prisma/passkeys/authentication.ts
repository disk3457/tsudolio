import { ApplicationError } from "@/application/shared/application-error";
import type { CurrentUserContext } from "@/application/security/types";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { AuditSeverity } from "@generated/prisma/enums";
import { recordAuthAuditEventInTransaction } from "@/infrastructure/prisma/audit-event-repository";
import { resolveCurrentUser } from "@/infrastructure/prisma/current-user-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { recordPasskeyAuthenticationFailure } from "@/infrastructure/prisma/passkeys/audit";
import {
  createPasskeyAuditMetadata,
  hashWebAuthnChallenge,
  invalidPasskeyAuthentication,
  normalizePasskeyAuthenticationInput,
  passkeyAuthenticationChallengeMinutes,
  readAuthenticationResponse,
  readTransports,
  resolveWebAuthnConfig,
  toWebAuthnCredential,
} from "@/infrastructure/prisma/passkeys/shared";

export async function createPasskeyAuthenticationOptions(input: {
  tenantCode: string;
  email: string;
  ipAddress?: string | null;
  origin?: string | null;
}) {
  const { email, tenantCode } = normalizePasskeyAuthenticationInput(input);
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (!tenant) {
    throw invalidPasskeyAuthentication();
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      tenantId: tenant.id,
    },
    select: {
      email: true,
      id: true,
      webAuthnCredentials: {
        select: {
          credentialId: true,
          transports: true,
        },
      },
    },
  });

  if (!user) {
    await recordPasskeyAuthenticationFailure({
      email,
      ipAddress: input.ipAddress,
      tenantId: tenant.id,
    }, "unknown_user");
    throw invalidPasskeyAuthentication();
  }

  if (user.webAuthnCredentials.length === 0) {
    await recordPasskeyAuthenticationFailure({
      email,
      ipAddress: input.ipAddress,
      tenantId: tenant.id,
      userId: user.id,
    }, "missing_credential");
    throw new ApplicationError(
      "PASSKEY_AUTHENTICATION_NOT_CONFIGURED",
      "この利用者にはPasskeyが登録されていません。",
      409,
    );
  }

  const config = resolveWebAuthnConfig(input.origin);
  const options = await generateAuthenticationOptions({
    allowCredentials: user.webAuthnCredentials.map((passkey) => ({
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
        tenantId: tenant.id,
        userId: user.id,
      },
    });
    await tx.webAuthnAuthenticationChallenge.create({
      data: {
        challengeHash: hashWebAuthnChallenge(options.challenge),
        expiresAt,
        tenantId: tenant.id,
        userId: user.id,
      },
    });
    await recordAuthAuditEventInTransaction(tx, {
      tenantId: tenant.id,
      actorId: user.id,
      action: "Passkeyログイン開始",
      targetType: "user",
      targetId: user.id,
      severity: AuditSeverity.INFO,
      ipAddress: input.ipAddress ?? null,
      metadata: createPasskeyAuditMetadata("challenge_issued", {
        email,
        expiresAt: expiresAt.toISOString(),
        rpId: config.rpID,
      }),
    });
  });

  return {
    options,
  };
}

export async function verifyPasskeyAuthentication(input: {
  tenantCode: string;
  email: string;
  response: unknown;
  ipAddress?: string | null;
  origin?: string | null;
}): Promise<CurrentUserContext> {
  const { email, tenantCode } = normalizePasskeyAuthenticationInput(input);
  const response = readAuthenticationResponse(input.response);
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
    select: {
      code: true,
      id: true,
    },
  });

  if (!tenant) {
    throw invalidPasskeyAuthentication();
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      tenantId: tenant.id,
    },
    select: {
      email: true,
      id: true,
    },
  });

  if (!user) {
    await recordPasskeyAuthenticationFailure({
      email,
      ipAddress: input.ipAddress,
      tenantId: tenant.id,
    }, "unknown_user");
    throw invalidPasskeyAuthentication();
  }

  const activeChallenges = await prisma.webAuthnAuthenticationChallenge.findMany({
    where: {
      expiresAt: {
        gt: new Date(),
      },
      tenantId: tenant.id,
      userId: user.id,
    },
    select: {
      challengeHash: true,
    },
  });

  if (activeChallenges.length === 0) {
    await recordPasskeyAuthenticationFailure({
      email,
      ipAddress: input.ipAddress,
      tenantId: tenant.id,
      userId: user.id,
    }, "challenge_missing");
    throw new ApplicationError(
      "PASSKEY_AUTHENTICATION_CHALLENGE_MISSING",
      "Passkeyログインを最初からやり直してください。",
      400,
    );
  }

  const passkey = await prisma.webAuthnCredential.findFirst({
    where: {
      credentialId: response.id,
      tenantId: tenant.id,
      userId: user.id,
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
    await recordPasskeyAuthenticationFailure({
      email,
      ipAddress: input.ipAddress,
      tenantId: tenant.id,
      userId: user.id,
    }, "unknown_credential", {
      credentialId: response.id,
    });
    throw invalidPasskeyAuthentication();
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
    await recordPasskeyAuthenticationFailure({
      email,
      ipAddress: input.ipAddress,
      tenantId: tenant.id,
      userId: user.id,
    }, "verification_failed", {
      credentialId: passkey.credentialId,
    });
    throw invalidPasskeyAuthentication();
  }

  if (!verification.verified) {
    await recordPasskeyAuthenticationFailure({
      email,
      ipAddress: input.ipAddress,
      tenantId: tenant.id,
      userId: user.id,
    }, "verification_rejected", {
      credentialId: passkey.credentialId,
    });
    throw invalidPasskeyAuthentication();
  }

  const { authenticationInfo } = verification;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.webAuthnAuthenticationChallenge.deleteMany({
      where: {
        tenantId: tenant.id,
        userId: user.id,
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
    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: now,
      },
    });
    await recordAuthAuditEventInTransaction(tx, {
      tenantId: tenant.id,
      actorId: user.id,
      action: "ログイン成功",
      targetType: "user",
      targetId: user.id,
      severity: AuditSeverity.NOTICE,
      ipAddress: input.ipAddress ?? null,
      metadata: createPasskeyAuditMetadata("success", {
        credentialId: passkey.credentialId,
        email,
        origin: authenticationInfo.origin,
        rpId: authenticationInfo.rpID,
      }),
    });
  });

  return resolveCurrentUser({
    tenantCode: tenant.code,
    userEmail: user.email,
  });
}
