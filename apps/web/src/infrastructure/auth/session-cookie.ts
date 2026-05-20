import { createHmac, timingSafeEqual } from "node:crypto";
import { ApplicationError } from "@/application/shared/application-error";

const sessionCookieName = "tsudolio_session";
const defaultSessionTtlSeconds = 8 * 60 * 60;

export type AuthSessionProvider =
  | "password"
  | "oidc"
  | "passkey"
  | "recovery_code";

export type AuthSessionStepUpProvider = "passkey";

export type AuthSession = {
  tenantCode: string;
  userEmail: string;
  provider: AuthSessionProvider;
  subject?: string;
  issuedAt: number;
  expiresAt: number;
  stepUpProvider?: AuthSessionStepUpProvider;
  stepUpAt?: number;
  stepUpExpiresAt?: number;
};

type CreateAuthSessionInput = {
  tenantCode: string;
  userEmail: string;
  provider: AuthSessionProvider;
  subject?: string;
  stepUpProvider?: AuthSessionStepUpProvider;
};

export function createAuthSessionCookie(
  input: CreateAuthSessionInput,
  request: Request,
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const ttlSeconds = getSessionTtlSeconds();
  const stepUpProvider =
    input.stepUpProvider ?? (input.provider === "passkey" ? "passkey" : null);
  const session: AuthSession = {
    tenantCode: input.tenantCode,
    userEmail: input.userEmail,
    provider: input.provider,
    subject: input.subject,
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
    ...(stepUpProvider
      ? {
          stepUpProvider,
          stepUpAt: issuedAt,
          stepUpExpiresAt: issuedAt + getStepUpTtlSeconds(),
        }
      : {}),
  };

  return {
    name: sessionCookieName,
    session,
    value: signSession(session),
    options: {
      httpOnly: true,
      maxAge: ttlSeconds,
      path: "/",
      sameSite: "lax" as const,
      secure: isSecureRequest(request),
    },
  };
}

export function readAuthSessionFromRequest(request: Request) {
  return readAuthSessionCookieValue(getCookie(request, sessionCookieName));
}

export function readAuthSessionCookieValue(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  const [payloadValue, signature] = value.split(".");

  if (!payloadValue || !signature) {
    return null;
  }

  let expectedSignature: Buffer;

  try {
    expectedSignature = createSignature(payloadValue);
  } catch {
    return null;
  }

  const actualSignature = Buffer.from(signature, "base64url");

  if (
    actualSignature.byteLength !== expectedSignature.byteLength ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  let payload: Partial<AuthSession>;

  try {
    payload = JSON.parse(
      Buffer.from(payloadValue, "base64url").toString("utf8"),
    ) as Partial<AuthSession>;
  } catch {
    return null;
  }

  if (!isAuthSession(payload)) {
    return null;
  }

  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function getAuthSessionCookieName() {
  return sessionCookieName;
}

export function getExpiredAuthSessionCookieOptions() {
  return {
    maxAge: 0,
    path: "/",
  };
}

export function isStepUpSessionFresh(session: AuthSession) {
  return (
    session.stepUpProvider === "passkey" &&
    typeof session.stepUpExpiresAt === "number" &&
    session.stepUpExpiresAt > Math.floor(Date.now() / 1000)
  );
}

function signSession(session: AuthSession) {
  const payloadValue = Buffer.from(JSON.stringify(session)).toString(
    "base64url",
  );
  return `${payloadValue}.${createSignature(payloadValue).toString("base64url")}`;
}

function createSignature(payloadValue: string) {
  return createHmac("sha256", getSessionSecret()).update(payloadValue).digest();
}

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new ApplicationError(
      "AUTH_SESSION_SECRET_MISSING",
      "AUTH_SESSION_SECRET には32文字以上の秘密値を設定してください。",
      500,
    );
  }

  return secret;
}

function getSessionTtlSeconds() {
  const ttlSeconds = Number(process.env.AUTH_SESSION_TTL_SECONDS);

  if (Number.isInteger(ttlSeconds) && ttlSeconds > 0) {
    return ttlSeconds;
  }

  return defaultSessionTtlSeconds;
}

function getStepUpTtlSeconds() {
  const ttlSeconds = Number(process.env.AUTH_STEP_UP_TTL_SECONDS);

  if (Number.isInteger(ttlSeconds) && ttlSeconds > 0) {
    return ttlSeconds;
  }

  return 10 * 60;
}

function isAuthSession(value: Partial<AuthSession>): value is AuthSession {
  const hasStepUpFields =
    typeof value.stepUpProvider !== "undefined" ||
    typeof value.stepUpAt !== "undefined" ||
    typeof value.stepUpExpiresAt !== "undefined";

  return (
    typeof value.tenantCode === "string" &&
    value.tenantCode.length > 0 &&
    typeof value.userEmail === "string" &&
    value.userEmail.length > 0 &&
    (value.provider === "password" ||
      value.provider === "oidc" ||
      value.provider === "passkey" ||
      value.provider === "recovery_code") &&
    typeof value.issuedAt === "number" &&
    typeof value.expiresAt === "number" &&
    (typeof value.subject === "undefined" || typeof value.subject === "string") &&
    (!hasStepUpFields ||
      (value.stepUpProvider === "passkey" &&
        typeof value.stepUpAt === "number" &&
        typeof value.stepUpExpiresAt === "number" &&
        value.stepUpExpiresAt > value.stepUpAt))
  );
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [key, ...valueParts] = cookie.trim().split("=");

    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function isSecureRequest(request: Request) {
  return (
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https" ||
    process.env.NODE_ENV === "production"
  );
}
