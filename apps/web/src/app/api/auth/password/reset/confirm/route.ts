import { getClientIpAddress } from "@/app/api/_shared/request-context";
import { parsePasswordResetConfirmInput } from "@/application/security/password-validation";
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
    const input = parsePasswordResetConfirmInput(
      await readRequestJson(
        request,
        "パスワードリセットデータのJSONを読み取れませんでした。",
      ),
    );
    const result = await prismaPasswordAuthRepository.confirmPasswordReset({
      ...input,
      ipAddress: getClientIpAddress(request),
    });

    return dataResponse(result);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSWORD_RESET_CONFIRM_UNAVAILABLE",
      "パスワードをリセットできませんでした。",
    );
  }
}
