import { createHash } from "node:crypto";
import { ApplicationError } from "@/application/shared/application-error";
import type {
  CurrentUserContext,
  PasskeySummary,
} from "@/application/security/types";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { AuditSeverity } from "@generated/prisma/enums";
import type { Prisma } from "@generated/prisma/client";
import {
  recordAuthAuditEvent,
  recordAuthAuditEventInTransaction,
} from "@/infrastructure/prisma/audit-event-repository";
import { resolveCurrentUser } from "@/infrastructure/prisma/current-user-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";

const passkeyAuthenticationChallengeMinutes = 5;
const passkeyRegistrationChallengeMinutes = 5;
const allowedTransports = new Set<string>([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

type PasskeyRecord = {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  transports: Prisma.JsonValue | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

type AuthenticationCredentialRecord = {
  credentialId: string;
  publicKey: Uint8Array;
  signCount: number;
  transports: Prisma.JsonValue | null;
};

export async function listPasskeys(
  currentUser: CurrentUserContext,
): Promise<{ passkeys: PasskeySummary[] }> {
  const passkeys = await prisma.webAuthnCredential.findMany({
    where: {
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: passkeySummarySelect,
  });

  return {
    passkeys: passkeys.map(toPasskeySummary),
  };
}

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
    throw new ApplicationError(
      "PASSKEY_NOT_FOUND",
      "Passkeyが見つかりません。",
      404,
    );
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

export const prismaPasskeyRepository = {
  createPasskeyAuthenticationOptions,
  createPasskeyRegistrationOptions,
  createPasskeyStepUpOptions,
  deletePasskey,
  listPasskeys,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
  verifyPasskeyStepUp,
};

const passkeySummarySelect = {
  id: true,
  name: true,
  deviceType: true,
  backedUp: true,
  transports: true,
  createdAt: true,
  lastUsedAt: true,
} satisfies Prisma.WebAuthnCredentialSelect;

function toPasskeySummary(passkey: PasskeyRecord): PasskeySummary {
  return {
    id: passkey.id,
    name: passkey.name ?? "Passkey",
    deviceType: passkey.deviceType,
    backedUp: passkey.backedUp,
    transports: readTransports(passkey.transports),
    createdAt: passkey.createdAt.toISOString(),
    lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null,
  };
}

function readRegistrationResponse(value: unknown): RegistrationResponseJSON {
  if (!isRecord(value) || !isRecord(value.response)) {
    throw invalidPasskeyRegistration();
  }

  if (
    typeof value.id !== "string" ||
    typeof value.rawId !== "string" ||
    value.type !== "public-key" ||
    !isRecord(value.clientExtensionResults) ||
    typeof value.response.clientDataJSON !== "string" ||
    typeof value.response.attestationObject !== "string"
  ) {
    throw invalidPasskeyRegistration();
  }

  const transports = value.response.transports;

  if (
    typeof transports !== "undefined" &&
    (!Array.isArray(transports) ||
      transports.some(
        (transport) =>
          typeof transport !== "string" || !allowedTransports.has(transport),
      ))
  ) {
    throw invalidPasskeyRegistration();
  }

  return value as unknown as RegistrationResponseJSON;
}

function readAuthenticationResponse(
  value: unknown,
): AuthenticationResponseJSON {
  if (!isRecord(value) || !isRecord(value.response)) {
    throw invalidPasskeyAuthentication();
  }

  if (
    typeof value.id !== "string" ||
    typeof value.rawId !== "string" ||
    value.type !== "public-key" ||
    !isRecord(value.clientExtensionResults) ||
    typeof value.response.clientDataJSON !== "string" ||
    typeof value.response.authenticatorData !== "string" ||
    typeof value.response.signature !== "string" ||
    (typeof value.response.userHandle !== "undefined" &&
      typeof value.response.userHandle !== "string")
  ) {
    throw invalidPasskeyAuthentication();
  }

  return value as unknown as AuthenticationResponseJSON;
}

function recordPasskeyRegistrationFailure(
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

function recordPasskeyAuthenticationFailure(
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

function recordPasskeyStepUpFailure(
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

function resolveWebAuthnConfig(origin: string | null | undefined) {
  const publicOrigin =
    process.env.TSUDOLIO_PUBLIC_BASE_URL?.trim() ||
    origin ||
    "http://localhost:3000";
  const url = new URL(publicOrigin);
  const rpID = normalizeLocalhostRpId(url.hostname);

  return {
    origin: `${url.protocol}//${url.host}`,
    rpID,
  };
}

function normalizeLocalhostRpId(hostname: string) {
  return hostname === "0.0.0.0" || hostname === "127.0.0.1"
    ? "localhost"
    : hostname;
}

function resolveRelyingPartyName(currentUser: CurrentUserContext) {
  return (
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    currentUser.tenantName ||
    "Tsudolio"
  );
}

function hashWebAuthnChallenge(challenge: string) {
  return createHash("sha256").update(challenge).digest("base64url");
}

function normalizePasskeyName(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizePasskeyAuthenticationInput(input: {
  tenantCode: string;
  email: string;
}) {
  const tenantCode = input.tenantCode.trim();
  const email = input.email.trim().toLowerCase();

  if (!tenantCode || !email) {
    throw invalidPasskeyAuthentication();
  }

  return {
    email,
    tenantCode,
  };
}

function toWebAuthnCredential(passkey: AuthenticationCredentialRecord) {
  return {
    counter: passkey.signCount,
    id: passkey.credentialId,
    publicKey: new Uint8Array(passkey.publicKey),
    transports: readTransports(passkey.transports),
  };
}

function readTransports(
  value: Prisma.JsonValue | AuthenticatorTransportFuture[] | undefined,
): AuthenticatorTransportFuture[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rawTransports: unknown[] = value;

  return rawTransports.filter(
    (transport): transport is AuthenticatorTransportFuture =>
      typeof transport === "string" && allowedTransports.has(transport),
  );
}

function createPasskeyAuditMetadata(
  outcome: string,
  extra: Prisma.InputJsonObject = {},
): Prisma.InputJsonObject {
  return {
    provider: "webauthn",
    outcome,
    ...extra,
  };
}

function invalidPasskeyRegistration() {
  return new ApplicationError(
    "PASSKEY_REGISTRATION_INVALID",
    "Passkey登録を完了できませんでした。",
    400,
  );
}

function invalidPasskeyAuthentication() {
  return new ApplicationError(
    "PASSKEY_AUTHENTICATION_INVALID",
    "Passkeyでログインできませんでした。",
    401,
  );
}

function invalidPasskeyStepUp() {
  return new ApplicationError(
    "PASSKEY_STEP_UP_INVALID",
    "Passkeyで本人確認できませんでした。",
    401,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
