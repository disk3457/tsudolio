import { NextResponse } from "next/server";
import {
  exchangeOidcAuthorizationCode,
  getOidcCookieNames,
  getOidcExpiredCookieOptions,
} from "@/infrastructure/auth/oidc-provider";
import { createAuthSessionCookie } from "@/infrastructure/auth/session-cookie";
import { prismaCurrentUserRepository } from "@/infrastructure/prisma/current-user-repository";
import { applicationErrorResponse } from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await exchangeOidcAuthorizationCode(request);
    const currentUser = await prismaCurrentUserRepository.resolveCurrentUser({
      tenantCode: identity.tenantCode,
      userEmail: identity.userEmail,
    });
    const session = createAuthSessionCookie(
      {
        provider: "oidc",
        subject: identity.subject,
        tenantCode: currentUser.tenantCode,
        userEmail: currentUser.email,
      },
      request,
    );
    const response = NextResponse.redirect(
      new URL(identity.nextUrl, new URL(request.url).origin),
    );
    const cookieNames = getOidcCookieNames();
    const expiredCookieOptions = getOidcExpiredCookieOptions();

    response.cookies.set(session.name, session.value, session.options);
    response.cookies.set(cookieNames.state, "", expiredCookieOptions);
    response.cookies.set(cookieNames.nonce, "", expiredCookieOptions);
    response.cookies.set(cookieNames.verifier, "", expiredCookieOptions);
    response.cookies.set(cookieNames.next, "", expiredCookieOptions);

    return response;
  } catch (error) {
    return applicationErrorResponse(
      error,
      "OIDC_CALLBACK_UNAVAILABLE",
      "OIDC callback を処理できませんでした。",
    );
  }
}
