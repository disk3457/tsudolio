import { createSecurityUseCases } from "@/application/security/use-cases";
import { prismaCurrentUserRepository } from "@/infrastructure/prisma/current-user-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";
import { getTenantCodeFromRequest } from "@/app/api/_shared/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const securityUseCases = createSecurityUseCases(prismaCurrentUserRepository);

export async function GET(request: Request) {
  try {
    const session = await securityUseCases.getCurrentUserSession({
      tenantCode: getTenantCodeFromRequest(request),
      userEmail: request.headers.get("x-tsudolio-user-email"),
    });

    return dataResponse(session);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "SESSION_UNAVAILABLE",
      "利用者情報を取得できませんでした。",
    );
  }
}

