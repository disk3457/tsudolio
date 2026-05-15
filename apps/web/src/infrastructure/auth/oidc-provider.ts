import { createHash, randomBytes, webcrypto } from "node:crypto";
import { ApplicationError } from "@/application/shared/application-error";

const stateCookieName = "tsudolio_oidc_state";
const nonceCookieName = "tsudolio_oidc_nonce";
const verifierCookieName = "tsudolio_oidc_verifier";
const nextCookieName = "tsudolio_oidc_next";
const oidcCallbackPath = process.env.OIDC_REDIRECT_PATH || "/api/auth/callback";
const defaultScope = "openid email profile";
const oidcClockSkewSeconds = 5 * 60;

export type AuthProviderStatus = {
  local: {
    configured: true;
    loginUrl: string;
  };
  oidc: {
    configured: boolean;
    loginUrl: string;
    callbackPath: string;
    issuerUrl: string | null;
    clientId: string | null;
    scopes: string[];
  };
};

export type OidcSessionIdentity = {
  tenantCode: string;
  userEmail: string;
  subject: string;
  nextUrl: string;
};

type OidcDiscoveryDocument = {
  authorization_endpoint?: unknown;
  token_endpoint?: unknown;
  jwks_uri?: unknown;
  issuer?: unknown;
};

type OidcTokenResponse = {
  id_token?: unknown;
};

type OidcCallbackInput = {
  code: string;
  state: string;
  nonce: string;
  verifier: string;
  nextUrl: string;
};

type IdTokenClaims = {
  iss?: unknown;
  sub?: unknown;
  aud?: unknown;
  azp?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
  email?: unknown;
  preferred_username?: unknown;
  [key: string]: unknown;
};

type JwksDocument = {
  keys?: unknown;
};

export function getAuthProviderStatus(): AuthProviderStatus {
  const config = getOidcConfig();

  return {
    local: {
      configured: true,
      loginUrl: "/login",
    },
    oidc: {
      configured: config.configured,
      loginUrl: "/api/auth/login",
      callbackPath: oidcCallbackPath,
      issuerUrl: config.issuerUrl,
      clientId: config.clientId,
      scopes: getOidcScopes(),
    },
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
  const nextUrl = sanitizeRelativeNextUrl(
    new URL(request.url).searchParams.get("next"),
  );

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
      nextUrl,
    },
  };
}

export async function exchangeOidcAuthorizationCode(
  request: Request,
): Promise<OidcSessionIdentity> {
  const config = requireOidcConfig();
  const discovery = await discoverOidcProvider(config.issuerUrl);
  const callback = validateOidcCallback(request);

  if (!discovery.tokenEndpoint || !discovery.jwksUri) {
    throw new ApplicationError(
      "OIDC_DISCOVERY_INVALID",
      "OIDC provider metadata に token_endpoint または jwks_uri がありません。",
      503,
    );
  }

  const tokenResponse = await exchangeCodeForTokens({
    callback,
    config,
    redirectUri: getRedirectUri(request),
    tokenEndpoint: discovery.tokenEndpoint,
  });
  const claims = await verifyIdToken(tokenResponse.id_token, {
    clientId: config.clientId,
    expectedNonce: callback.nonce,
    issuer: discovery.issuer,
    jwksUri: discovery.jwksUri,
  });

  return {
    tenantCode: resolveTenantCode(claims),
    userEmail: resolveEmail(claims),
    subject: resolveSubject(claims),
    nextUrl: callback.nextUrl,
  };
}

export function getOidcCookieNames() {
  return {
    state: stateCookieName,
    nonce: nonceCookieName,
    verifier: verifierCookieName,
    next: nextCookieName,
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

function validateOidcCallback(request: Request): OidcCallbackInput {
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
  const nonce = getCookie(request, nonceCookieName);
  const verifier = getCookie(request, verifierCookieName);

  if (!code || !state) {
    throw new ApplicationError(
      "OIDC_CALLBACK_INCOMPLETE",
      "OIDC callback に必要な code または state がありません。",
      400,
    );
  }

  if (!expectedState || state !== expectedState || !nonce || !verifier) {
    throw new ApplicationError(
      "OIDC_STATE_MISMATCH",
      "OIDC state を確認できませんでした。ログインをやり直してください。",
      400,
    );
  }

  return {
    code,
    state,
    nonce,
    verifier,
    nextUrl: sanitizeRelativeNextUrl(getCookie(request, nextCookieName)),
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
    jwksUri: typeof document.jwks_uri === "string" ? document.jwks_uri : null,
    tokenEndpoint:
      typeof document.token_endpoint === "string"
        ? document.token_endpoint
        : null,
  };
}

async function exchangeCodeForTokens({
  callback,
  config,
  redirectUri,
  tokenEndpoint,
}: {
  callback: OidcCallbackInput;
  config: ReturnType<typeof requireOidcConfig>;
  redirectUri: string;
  tokenEndpoint: string;
}): Promise<{ id_token: string }> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    code: callback.code,
    code_verifier: callback.verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  const response = await fetch(tokenEndpoint, {
    body,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new ApplicationError(
      "OIDC_TOKEN_EXCHANGE_FAILED",
      "OIDC token endpoint で認可コードを交換できませんでした。",
      502,
    );
  }

  const payload = (await response.json()) as OidcTokenResponse;

  if (typeof payload.id_token !== "string") {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_MISSING",
      "OIDC token response に id_token がありません。",
      502,
    );
  }

  return {
    id_token: payload.id_token,
  };
}

async function verifyIdToken(
  idToken: unknown,
  expected: {
    clientId: string;
    expectedNonce: string;
    issuer: string;
    jwksUri: string;
  },
) {
  if (typeof idToken !== "string") {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_INVALID",
      "OIDC id_token を確認できませんでした。",
      401,
    );
  }

  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_INVALID",
      "OIDC id_token の形式が正しくありません。",
      401,
    );
  }

  const header = decodeBase64UrlJson(encodedHeader) as {
    alg?: unknown;
    kid?: unknown;
  };
  const claims = decodeBase64UrlJson(encodedPayload) as IdTokenClaims;
  const jwk = await findSigningKey(expected.jwksUri, header);
  const isValidSignature = await verifyJwtSignature({
    encodedHeader,
    encodedPayload,
    encodedSignature,
    header,
    jwk,
  });

  if (!isValidSignature) {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_SIGNATURE_INVALID",
      "OIDC id_token の署名を確認できませんでした。",
      401,
    );
  }

  validateIdTokenClaims(claims, expected);

  return claims;
}

async function findSigningKey(
  jwksUri: string,
  header: {
    alg?: unknown;
    kid?: unknown;
  },
) {
  const response = await fetch(jwksUri, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new ApplicationError(
      "OIDC_JWKS_UNAVAILABLE",
      "OIDC JWKS を取得できませんでした。",
      503,
    );
  }

  const document = (await response.json()) as JwksDocument;
  const keys = Array.isArray(document.keys) ? document.keys : [];
  const key = keys.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (typeof header.kid !== "string" ||
        (item as { kid?: unknown }).kid === header.kid),
  );

  if (!key || typeof key !== "object") {
    throw new ApplicationError(
      "OIDC_JWKS_KEY_NOT_FOUND",
      "OIDC id_token に対応する署名鍵が見つかりません。",
      401,
    );
  }

  return key as JsonWebKey;
}

async function verifyJwtSignature({
  encodedHeader,
  encodedPayload,
  encodedSignature,
  header,
  jwk,
}: {
  encodedHeader: string;
  encodedPayload: string;
  encodedSignature: string;
  header: {
    alg?: unknown;
  };
  jwk: JsonWebKey;
}) {
  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = Buffer.from(encodedSignature, "base64url");

  if (header.alg === "RS256") {
    const key = await webcrypto.subtle.importKey(
      "jwk",
      jwk,
      {
        hash: "SHA-256",
        name: "RSASSA-PKCS1-v1_5",
      },
      false,
      ["verify"],
    );

    return webcrypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      signingInput,
    );
  }

  if (header.alg === "ES256") {
    const key = await webcrypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      false,
      ["verify"],
    );

    return webcrypto.subtle.verify(
      {
        hash: "SHA-256",
        name: "ECDSA",
      },
      key,
      signature,
      signingInput,
    );
  }

  throw new ApplicationError(
    "OIDC_ID_TOKEN_ALG_UNSUPPORTED",
    "OIDC id_token の署名アルゴリズムに対応していません。",
    401,
  );
}

function validateIdTokenClaims(
  claims: IdTokenClaims,
  expected: {
    clientId: string;
    expectedNonce: string;
    issuer: string;
  },
) {
  const now = Math.floor(Date.now() / 1000);

  if (claims.iss !== expected.issuer) {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_ISSUER_INVALID",
      "OIDC id_token の issuer が一致しません。",
      401,
    );
  }

  if (!isAudienceValid(claims.aud, expected.clientId)) {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_AUDIENCE_INVALID",
      "OIDC id_token の audience が一致しません。",
      401,
    );
  }

  if (
    Array.isArray(claims.aud) &&
    claims.aud.length > 1 &&
    claims.azp !== expected.clientId
  ) {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_AUTHORIZED_PARTY_INVALID",
      "OIDC id_token の authorized party が一致しません。",
      401,
    );
  }

  if (
    typeof claims.exp !== "number" ||
    claims.exp <= now - oidcClockSkewSeconds
  ) {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_EXPIRED",
      "OIDC id_token の有効期限が切れています。",
      401,
    );
  }

  if (
    typeof claims.iat === "number" &&
    claims.iat > now + oidcClockSkewSeconds
  ) {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_IAT_INVALID",
      "OIDC id_token の発行時刻を確認できません。",
      401,
    );
  }

  if (claims.nonce !== expected.expectedNonce) {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_NONCE_INVALID",
      "OIDC id_token の nonce が一致しません。",
      401,
    );
  }
}

function resolveEmail(claims: IdTokenClaims) {
  const configuredClaim = process.env.OIDC_EMAIL_CLAIM?.trim();
  const emailCandidate =
    (configuredClaim && claims[configuredClaim]) ||
    claims.email ||
    claims.preferred_username;

  if (typeof emailCandidate === "string" && emailCandidate.includes("@")) {
    return emailCandidate.trim().toLowerCase();
  }

  throw new ApplicationError(
    "OIDC_EMAIL_REQUIRED",
    "OIDC id_token からメールアドレスを確認できませんでした。",
    401,
  );
}

function resolveSubject(claims: IdTokenClaims) {
  if (typeof claims.sub === "string" && claims.sub) {
    return claims.sub;
  }

  throw new ApplicationError(
    "OIDC_SUBJECT_REQUIRED",
    "OIDC id_token から subject を確認できませんでした。",
    401,
  );
}

function resolveTenantCode(claims: IdTokenClaims) {
  const claimName = process.env.OIDC_TENANT_CODE_CLAIM?.trim();
  const claimValue = claimName ? claims[claimName] : null;
  const tenantCode =
    (typeof claimValue === "string" && claimValue.trim()) ||
    process.env.OIDC_TENANT_CODE?.trim() ||
    process.env.TSUDOLIO_TENANT_CODE?.trim();

  if (!tenantCode) {
    throw new ApplicationError(
      "OIDC_TENANT_REQUIRED",
      "OIDC 利用者を解決するテナントコードを設定してください。",
      500,
    );
  }

  return tenantCode;
}

function isAudienceValid(audience: unknown, clientId: string) {
  return (
    audience === clientId ||
    (Array.isArray(audience) && audience.includes(clientId))
  );
}

function decodeBase64UrlJson(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new ApplicationError(
      "OIDC_ID_TOKEN_INVALID",
      "OIDC id_token を読み取れませんでした。",
      401,
    );
  }
}

function getOidcConfig() {
  const issuerUrl = normalizeIssuerUrl(process.env.OIDC_ISSUER_URL);
  const clientId = process.env.OIDC_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.OIDC_CLIENT_SECRET?.trim() || null;

  return {
    issuerUrl,
    clientId,
    clientSecret,
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
    clientSecret: config.clientSecret,
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

function sanitizeRelativeNextUrl(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
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
