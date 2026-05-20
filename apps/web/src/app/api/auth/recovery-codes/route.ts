import {
  getClientIpAddress,
  getCurrentUserFromRequest,
} from "@/app/api/_shared/request-context";
import { prismaRecoveryCodeRepository } from "@/infrastructure/prisma/recovery-code-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    return dataResponse(
      await prismaRecoveryCodeRepository.getRecoveryCodes(currentUser),
    );
  } catch (error) {
    return applicationErrorResponse(
      error,
      "RECOVERY_CODES_UNAVAILABLE",
      "リカバリーコード情報を取得できませんでした。",
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    return dataResponse(
      await prismaRecoveryCodeRepository.generateRecoveryCodes({
        currentUser,
        ipAddress: getClientIpAddress(request),
      }),
      201,
    );
  } catch (error) {
    return applicationErrorResponse(
      error,
      "RECOVERY_CODES_GENERATE_UNAVAILABLE",
      "リカバリーコードを発行できませんでした。",
    );
  }
}
