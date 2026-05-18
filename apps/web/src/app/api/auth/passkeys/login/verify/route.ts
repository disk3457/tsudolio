import { getClientIpAddress } from "@/app/api/_shared/request-context";
import { getRequestOrigin } from "@/app/api/_shared/request-origin";
import { createSecurityUseCases } from "@/application/security/use-cases";
import { parsePasskeyAuthenticationVerifyInput } from "@/application/security/passkey-validation";
import { createAuthSessionCookie } from "@/infrastructure/auth/session-cookie";
import { prismaCurrentUserRepository } from "@/infrastructure/prisma/current-user-repository";
import { prismaPasskeyRepository } from "@/infrastructure/prisma/passkey-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const securityUseCases = createSecurityUseCases(prismaCurrentUserRepository);

export async function POST(request: Request) {
  try {
    const input = parsePasskeyAuthenticationVerifyInput(
      await readRequestJson(
        request,
        "Passkeyログイン検証データのJSONを読み取れませんでした。",
      ),
      process.env.TSUDOLIO_TENANT_CODE,
    );
    const currentUser =
      await prismaPasskeyRepository.verifyPasskeyAuthentication({
        email: input.email,
        ipAddress: getClientIpAddress(request),
        origin: getRequestOrigin(request),
        response: input.response,
        tenantCode: input.tenantCode,
      });
    const session = createAuthSessionCookie(
      {
        provider: "passkey",
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
      "PASSKEY_AUTHENTICATION_VERIFY_UNAVAILABLE",
      "Passkeyログインを完了できませんでした。",
    );
  }
}
