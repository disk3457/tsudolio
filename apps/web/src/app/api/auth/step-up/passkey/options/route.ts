import {
  getClientIpAddress,
  getCurrentUserFromRequest,
} from "@/app/api/_shared/request-context";
import { getRequestOrigin } from "@/app/api/_shared/request-origin";
import { prismaPasskeyRepository } from "@/infrastructure/prisma/passkey-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    return dataResponse(
      await prismaPasskeyRepository.createPasskeyStepUpOptions({
        currentUser,
        ipAddress: getClientIpAddress(request),
        origin: getRequestOrigin(request),
      }),
    );
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSKEY_STEP_UP_OPTIONS_UNAVAILABLE",
      "Passkey本人確認を開始できませんでした。",
    );
  }
}
