import {
  getClientIpAddress,
  getCurrentUserFromRequest,
  requireAuthSessionFromRequest,
} from "@/app/api/_shared/request-context";
import { getRequestOrigin } from "@/app/api/_shared/request-origin";
import { parsePasskeyStepUpVerifyInput } from "@/application/security/passkey-validation";
import { createAuthSessionCookie } from "@/infrastructure/auth/session-cookie";
import { prismaPasskeyRepository } from "@/infrastructure/prisma/passkey-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = requireAuthSessionFromRequest(request);
    const currentUser = await getCurrentUserFromRequest(request);
    const input = parsePasskeyStepUpVerifyInput(
      await readRequestJson(
        request,
        "Passkey本人確認データのJSONを読み取れませんでした。",
      ),
    );

    await prismaPasskeyRepository.verifyPasskeyStepUp({
      currentUser,
      response: input.response,
      ipAddress: getClientIpAddress(request),
      origin: getRequestOrigin(request),
    });

    const refreshedSession = createAuthSessionCookie(
      {
        provider: session.provider,
        tenantCode: session.tenantCode,
        userEmail: session.userEmail,
        subject: session.subject,
        stepUpProvider: "passkey",
      },
      request,
    );
    const response = dataResponse({
      expiresAt: new Date(
        (refreshedSession.session.stepUpExpiresAt ?? 0) * 1000,
      ).toISOString(),
      verified: true,
    });

    response.cookies.set(
      refreshedSession.name,
      refreshedSession.value,
      refreshedSession.options,
    );

    return response;
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSKEY_STEP_UP_VERIFY_UNAVAILABLE",
      "Passkey本人確認を完了できませんでした。",
    );
  }
}
