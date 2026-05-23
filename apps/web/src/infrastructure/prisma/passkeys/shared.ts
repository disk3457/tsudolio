import { createHash } from "node:crypto";
import { ApplicationError } from "@/application/shared/application-error";
import type {
  CurrentUserContext,
  PasskeySummary,
} from "@/application/security/types";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { Prisma } from "@generated/prisma/client";

export const passkeyAuthenticationChallengeMinutes = 5;
export const passkeyRegistrationChallengeMinutes = 5;

const allowedTransports = new Set<string>([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

export type PasskeyRecord = {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  transports: Prisma.JsonValue | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

export type AuthenticationCredentialRecord = {
  credentialId: string;
  publicKey: Uint8Array;
  signCount: number;
  transports: Prisma.JsonValue | null;
};

export const passkeySummarySelect = {
  id: true,
  name: true,
  deviceType: true,
  backedUp: true,
  transports: true,
  createdAt: true,
  lastUsedAt: true,
} satisfies Prisma.WebAuthnCredentialSelect;

export function toPasskeySummary(passkey: PasskeyRecord): PasskeySummary {
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

export function readRegistrationResponse(
  value: unknown,
): RegistrationResponseJSON {
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

export function readAuthenticationResponse(
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

export function resolveWebAuthnConfig(origin: string | null | undefined) {
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

export function resolveRelyingPartyName(currentUser: CurrentUserContext) {
  return (
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    currentUser.tenantName ||
    "Tsudolio"
  );
}

export function hashWebAuthnChallenge(challenge: string) {
  return createHash("sha256").update(challenge).digest("base64url");
}

export function normalizePasskeyName(value: string | null | undefined) {
  return value?.trim() || null;
}

export function normalizePasskeyAuthenticationInput(input: {
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

export function toWebAuthnCredential(passkey: AuthenticationCredentialRecord) {
  return {
    counter: passkey.signCount,
    id: passkey.credentialId,
    publicKey: new Uint8Array(passkey.publicKey),
    transports: readTransports(passkey.transports),
  };
}

export function readTransports(
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

export function createPasskeyAuditMetadata(
  outcome: string,
  extra: Prisma.InputJsonObject = {},
): Prisma.InputJsonObject {
  return {
    provider: "webauthn",
    outcome,
    ...extra,
  };
}

export function invalidPasskeyRegistration() {
  return new ApplicationError(
    "PASSKEY_REGISTRATION_INVALID",
    "Passkey登録を完了できませんでした。",
    400,
  );
}

export function invalidPasskeyAuthentication() {
  return new ApplicationError(
    "PASSKEY_AUTHENTICATION_INVALID",
    "Passkeyでログインできませんでした。",
    401,
  );
}

export function invalidPasskeyStepUp() {
  return new ApplicationError(
    "PASSKEY_STEP_UP_INVALID",
    "Passkeyで本人確認できませんでした。",
    401,
  );
}

function normalizeLocalhostRpId(hostname: string) {
  return hostname === "0.0.0.0" || hostname === "127.0.0.1"
    ? "localhost"
    : hostname;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
