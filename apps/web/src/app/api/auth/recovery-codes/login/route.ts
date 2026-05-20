import { getClientIpAddress } from "@/app/api/_shared/request-context";
import { parseRecoveryCodeLoginInput } from "@/application/security/recovery-code-validation";
import { createSecurityUseCases } from "@/application/security/use-cases";
import { createAuthSessionCookie } from "@/infrastructure/auth/session-cookie";
import { prismaCurrentUserRepository } from "@/infrastructure/prisma/current-user-repository";
import { prismaRecoveryCodeRepository } from "@/infrastructure/prisma/recovery-code-repository";
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
    const input = parseRecoveryCodeLoginInput(
      await readRequestJson(
        request,
        "リカバリーコードログインデータのJSONを読み取れませんでした。",
      ),
      process.env.TSUDOLIO_TENANT_CODE,
    );
    const currentUser =
      await prismaRecoveryCodeRepository.authenticateWithRecoveryCode({
        code: input.code,
        email: input.email,
        ipAddress: getClientIpAddress(request),
        tenantCode: input.tenantCode,
      });
    const session = createAuthSessionCookie(
      {
        provider: "recovery_code",
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
      "RECOVERY_CODE_LOGIN_UNAVAILABLE",
      "リカバリーコードログインを処理できませんでした。",
    );
  }
}
