import { NextResponse } from "next/server";
import { createSecurityUseCases } from "@/application/security/use-cases";
import { ApplicationError } from "@/application/shared/application-error";
import {
  createOidcAuthorizationUrl,
  getOidcCookieNames,
  getOidcCookieOptions,
} from "@/infrastructure/auth/oidc-provider";
import { createAuthSessionCookie } from "@/infrastructure/auth/session-cookie";
import { prismaCurrentUserRepository } from "@/infrastructure/prisma/current-user-repository";
import { prismaPasswordAuthRepository } from "@/infrastructure/prisma/password-auth-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const securityUseCases = createSecurityUseCases(prismaCurrentUserRepository);

export async function GET(request: Request) {
  try {
    const { authorizationUrl, cookies } =
      await createOidcAuthorizationUrl(request);
    const response = NextResponse.redirect(authorizationUrl);
    const cookieNames = getOidcCookieNames();
    const cookieOptions = getOidcCookieOptions(request);

    response.cookies.set(cookieNames.state, cookies.state, cookieOptions);
    response.cookies.set(cookieNames.nonce, cookies.nonce, cookieOptions);
    response.cookies.set(cookieNames.verifier, cookies.verifier, cookieOptions);
    response.cookies.set(cookieNames.next, cookies.nextUrl, cookieOptions);

    return response;
  } catch (error) {
    return applicationErrorResponse(
      error,
      "OIDC_LOGIN_UNAVAILABLE",
      "OIDC ログインを開始できませんでした。",
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = parseLoginPayload(
      await readRequestJson(request, "ログインデータのJSONを読み取れませんでした。"),
    );
    const currentUser =
      await prismaPasswordAuthRepository.authenticateWithPassword(payload);
    const session = createAuthSessionCookie(
      {
        provider: "password",
        tenantCode: currentUser.tenantCode,
        userEmail: currentUser.email,
      },
      request,
    );
    const response = dataResponse(
      await securityUseCases.getCurrentUserSession({
        tenantCode: currentUser.tenantCode,
        userEmail: currentUser.email,
      }),
    );

    response.cookies.set(session.name, session.value, session.options);

    return response;
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSWORD_LOGIN_UNAVAILABLE",
      "ログインを処理できませんでした。",
    );
  }
}

function parseLoginPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return invalidLoginPayload();
  }

  const values = payload as {
    tenantCode?: unknown;
    email?: unknown;
    password?: unknown;
  };
  const tenantCode =
    typeof values.tenantCode === "string" && values.tenantCode.trim()
      ? values.tenantCode.trim()
      : process.env.TSUDOLIO_TENANT_CODE?.trim();

  if (
    !tenantCode ||
    typeof values.email !== "string" ||
    typeof values.password !== "string"
  ) {
    return invalidLoginPayload();
  }

  return {
    tenantCode,
    email: values.email,
    password: values.password,
  };
}

function invalidLoginPayload(): never {
  throw new ApplicationError(
    "LOGIN_INPUT_INVALID",
    "テナントコード、メールアドレス、パスワードを入力してください。",
    400,
  );
}
