import { NextResponse } from "next/server";
import { getClientIpAddress } from "@/app/api/_shared/request-context";
import {
  exchangeOidcAuthorizationCode,
  getOidcCookieNames,
  getOidcExpiredCookieOptions,
} from "@/infrastructure/auth/oidc-provider";
import { createAuthSessionCookie } from "@/infrastructure/auth/session-cookie";
import { recordAuthAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import { prismaAuthPolicyRepository } from "@/infrastructure/prisma/auth-policy-repository";
import { prismaCurrentUserRepository } from "@/infrastructure/prisma/current-user-repository";
import { applicationErrorResponse } from "@/presentation/http/json-response";
import { AuditSeverity } from "@generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await exchangeOidcAuthorizationCode(request);
    const currentUser = await prismaCurrentUserRepository.resolveCurrentUser({
      tenantCode: identity.tenantCode,
      userEmail: identity.userEmail,
    });
    await prismaAuthPolicyRepository.assertAuthPolicyAllowsLogin({
      currentUser,
      provider: "oidc",
      subject: identity.subject,
      ipAddress: getClientIpAddress(request),
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

    await recordAuthAuditEvent({
      tenantId: currentUser.tenantId,
      actorId: currentUser.userId,
      action: "ログイン成功",
      targetType: "user",
      targetId: currentUser.userId,
      severity: AuditSeverity.NOTICE,
      ipAddress: getClientIpAddress(request),
      metadata: {
        provider: "oidc",
        outcome: "success",
        subject: identity.subject,
        email: currentUser.email,
      },
    });

    return response;
  } catch (error) {
    return applicationErrorResponse(
      error,
      "OIDC_CALLBACK_UNAVAILABLE",
      "OIDC callback を処理できませんでした。",
    );
  }
}
