import { createHash, randomBytes } from "node:crypto";
import { ApplicationError } from "@/application/shared/application-error";

const stateCookieName = "tsudolio_oidc_state";
const nonceCookieName = "tsudolio_oidc_nonce";
const verifierCookieName = "tsudolio_oidc_verifier";
const oidcCallbackPath = process.env.OIDC_REDIRECT_PATH || "/api/auth/callback";
const defaultScope = "openid email profile";

export type AuthProviderStatus = {
  mode: "demo" | "oidc";
  configured: boolean;
  loginUrl: string;
  callbackPath: string;
  issuerUrl: string | null;
  clientId: string | null;
  scopes: string[];
};

export type OidcCallbackResult = {
  code: string;
  state: string;
  next: "token_exchange";
};

type OidcDiscoveryDocument = {
  authorization_endpoint?: unknown;
  token_endpoint?: unknown;
  issuer?: unknown;
};

export function getAuthProviderStatus(): AuthProviderStatus {
  const config = getOidcConfig();

  return {
    mode: config.configured ? "oidc" : "demo",
    configured: config.configured,
    loginUrl: "/api/auth/login",
    callbackPath: oidcCallbackPath,
    issuerUrl: config.issuerUrl,
    clientId: config.clientId,
    scopes: getOidcScopes(),
  };
}

export async function createOidcAuthorizationUrl(request: Request) {
  const config = requireOidcConfig();
  const discovery = await discoverOidcProvider(config.issuerUrl);
  const redirectUri = getRedirectUri(request);
  const state = createRandomToken();
  const nonce = createRandomToken();
  const verifier = createRandomToken(48);
  const challenge = createCodeChallenge(verifier);
  const authorizationUrl = new URL(discovery.authorizationEndpoint);

  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", getOidcScopes().join(" "));
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);
  authorizationUrl.searchParams.set("code_challenge", challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  return {
    authorizationUrl,
    cookies: {
      state,
      nonce,
      verifier,
    },
  };
}

export function validateOidcCallback(request: Request): OidcCallbackResult {
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");

  if (providerError) {
    throw new ApplicationError(
      "OIDC_PROVIDER_ERROR",
      url.searchParams.get("error_description") || providerError,
      400,
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = getCookie(request, stateCookieName);
  const verifier = getCookie(request, verifierCookieName);

  if (!code || !state) {
    throw new ApplicationError(
      "OIDC_CALLBACK_INCOMPLETE",
      "OIDC callback に必要な code または state がありません。",
      400,
    );
  }

  if (!expectedState || state !== expectedState || !verifier) {
    throw new ApplicationError(
      "OIDC_STATE_MISMATCH",
      "OIDC state を確認できませんでした。ログインをやり直してください。",
      400,
    );
  }

  return {
    code,
    state,
    next: "token_exchange",
  };
}

export function getOidcCookieNames() {
  return {
    state: stateCookieName,
    nonce: nonceCookieName,
    verifier: verifierCookieName,
  };
}

export function getOidcCookieOptions(request: Request) {
  return {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/api/auth",
    sameSite: "lax" as const,
    secure: isSecureRequest(request),
  };
}

export function getOidcExpiredCookieOptions() {
  return {
    maxAge: 0,
    path: "/api/auth",
  };
}

async function discoverOidcProvider(issuerUrl: string) {
  const discoveryUrl = new URL(
    `${issuerUrl.replace(/\/$/, "")}/.well-known/openid-configuration`,
  );
  const response = await fetch(discoveryUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new ApplicationError(
      "OIDC_DISCOVERY_FAILED",
      "OIDC provider metadata を取得できませんでした。",
      503,
    );
  }

  const document = (await response.json()) as OidcDiscoveryDocument;

  if (typeof document.authorization_endpoint !== "string") {
    throw new ApplicationError(
      "OIDC_DISCOVERY_INVALID",
      "OIDC provider metadata に authorization_endpoint がありません。",
      503,
    );
  }

  return {
    authorizationEndpoint: document.authorization_endpoint,
    issuer:
      typeof document.issuer === "string" ? document.issuer : issuerUrl,
    tokenEndpoint:
      typeof document.token_endpoint === "string"
        ? document.token_endpoint
        : null,
  };
}

function getOidcConfig() {
  const issuerUrl = normalizeIssuerUrl(process.env.OIDC_ISSUER_URL);
  const clientId = process.env.OIDC_CLIENT_ID?.trim() || null;

  return {
    issuerUrl,
    clientId,
    configured: Boolean(issuerUrl && clientId),
  };
}

function requireOidcConfig() {
  const config = getOidcConfig();

  if (!config.issuerUrl || !config.clientId) {
    throw new ApplicationError(
      "OIDC_NOT_CONFIGURED",
      "OIDC_ISSUER_URL と OIDC_CLIENT_ID を設定してください。",
      501,
    );
  }

  return {
    issuerUrl: config.issuerUrl,
    clientId: config.clientId,
  };
}

function normalizeIssuerUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new ApplicationError(
      "OIDC_ISSUER_INVALID",
      "OIDC_ISSUER_URL が URL として解釈できません。",
      500,
    );
  }
}

function getOidcScopes() {
  return (process.env.OIDC_SCOPE || defaultScope)
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function getRedirectUri(request: Request) {
  const baseUrl = process.env.TSUDOLIO_PUBLIC_BASE_URL?.trim();
  const origin = baseUrl || new URL(request.url).origin;
  return new URL(oidcCallbackPath, origin).toString();
}

function createRandomToken(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
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
