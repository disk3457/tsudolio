import { getClientIpAddress } from "@/app/api/_shared/request-context";
import { getRequestOrigin } from "@/app/api/_shared/request-origin";
import { parsePasskeyAuthenticationOptionsInput } from "@/application/security/passkey-validation";
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
    const input = parsePasskeyAuthenticationOptionsInput(
      await readRequestJson(
        request,
        "Passkeyログイン申請データのJSONを読み取れませんでした。",
      ),
      process.env.TSUDOLIO_TENANT_CODE,
    );
    const result =
      await prismaPasskeyRepository.createPasskeyAuthenticationOptions({
        email: input.email,
        ipAddress: getClientIpAddress(request),
        origin: getRequestOrigin(request),
        tenantCode: input.tenantCode,
      });

    return dataResponse(result);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSKEY_AUTHENTICATION_OPTIONS_UNAVAILABLE",
      "Passkeyログインを開始できませんでした。",
    );
  }
}
