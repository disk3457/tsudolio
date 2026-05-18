import { getClientIpAddress } from "@/app/api/_shared/request-context";
import { getRequestOrigin } from "@/app/api/_shared/request-origin";
import { parsePasswordResetRequestInput } from "@/application/security/password-validation";
import { prismaPasswordAuthRepository } from "@/infrastructure/prisma/password-auth-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = parsePasswordResetRequestInput(
      await readRequestJson(
        request,
        "パスワードリセット申請データのJSONを読み取れませんでした。",
      ),
    );
    const result = await prismaPasswordAuthRepository.requestPasswordReset({
      ...input,
      ipAddress: getClientIpAddress(request),
      origin: getRequestOrigin(request),
    });

    return dataResponse(result);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSWORD_RESET_REQUEST_UNAVAILABLE",
      "パスワードリセットを申請できませんでした。",
    );
  }
}
