import {
  getClientIpAddress,
  getCurrentUserFromRequest,
} from "@/app/api/_shared/request-context";
import { getRequestOrigin } from "@/app/api/_shared/request-origin";
import { parsePasskeyRegistrationVerifyInput } from "@/application/security/passkey-validation";
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
    const input = parsePasskeyRegistrationVerifyInput(
      await readRequestJson(
        request,
        "Passkey登録データのJSONを読み取れませんでした。",
      ),
    );
    const currentUser = await getCurrentUserFromRequest(request);
    const result = await prismaPasskeyRepository.verifyPasskeyRegistration({
      currentUser,
      name: input.name,
      response: input.response,
      ipAddress: getClientIpAddress(request),
      origin: getRequestOrigin(request),
    });

    return dataResponse(result);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSKEY_REGISTRATION_VERIFY_UNAVAILABLE",
      "Passkey登録を完了できませんでした。",
    );
  }
}
