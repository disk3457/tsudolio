import { NextResponse } from "next/server";
import { getClientIpAddress } from "@/app/api/_shared/request-context";
import {
  getAuthSessionCookieName,
  getExpiredAuthSessionCookieOptions,
  readAuthSessionFromRequest,
} from "@/infrastructure/auth/session-cookie";
import { recordAuthAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import { prismaCurrentUserRepository } from "@/infrastructure/prisma/current-user-repository";
import { AuditSeverity } from "@generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await recordLogoutAuditEvent(request);

  const response = NextResponse.json({
    data: {
      status: "signed_out",
    },
    source: "auth",
  });

  response.cookies.set(
    getAuthSessionCookieName(),
    "",
    getExpiredAuthSessionCookieOptions(),
  );

  return response;
}

async function recordLogoutAuditEvent(request: Request) {
  const session = readAuthSessionFromRequest(request);

  if (!session) {
    return;
  }

  try {
    const currentUser = await prismaCurrentUserRepository.resolveCurrentUser({
      tenantCode: session.tenantCode,
      userEmail: session.userEmail,
    });

    await recordAuthAuditEvent({
      tenantId: currentUser.tenantId,
      actorId: currentUser.userId,
      action: "ログアウト",
      targetType: "user",
      targetId: currentUser.userId,
      severity: AuditSeverity.INFO,
      ipAddress: getClientIpAddress(request),
      metadata: {
        provider: session.provider,
        outcome: "success",
        email: currentUser.email,
        ...(session.subject ? { subject: session.subject } : {}),
      },
    });
  } catch {
    // Logout should still clear the browser cookie if the stored session is stale.
  }
}
