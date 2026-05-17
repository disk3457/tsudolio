import {
  getClientIpAddress,
  getCurrentUserFromRequest,
} from "@/app/api/_shared/request-context";
import { getRequestOrigin } from "@/app/api/_shared/request-origin";
import { parsePasskeyRegistrationOptionsInput } from "@/application/security/passkey-validation";
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
    parsePasskeyRegistrationOptionsInput(
      await readRequestJson(
        request,
        "Passkey登録オプション申請データのJSONを読み取れませんでした。",
      ),
    );
    const currentUser = await getCurrentUserFromRequest(request);
    const result =
      await prismaPasskeyRepository.createPasskeyRegistrationOptions({
        currentUser,
        ipAddress: getClientIpAddress(request),
        origin: getRequestOrigin(request),
      });

    return dataResponse(result);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSKEY_REGISTRATION_OPTIONS_UNAVAILABLE",
      "Passkey登録を開始できませんでした。",
    );
  }
}
