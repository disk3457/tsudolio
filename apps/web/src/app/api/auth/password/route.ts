import {
  getClientIpAddress,
  getCurrentUserFromRequest,
} from "@/app/api/_shared/request-context";
import { parsePasswordChangeInput } from "@/application/security/password-validation";
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
    const currentUser = await getCurrentUserFromRequest(request);
    const input = parsePasswordChangeInput(
      await readRequestJson(
        request,
        "パスワード変更データのJSONを読み取れませんでした。",
      ),
    );
    const result = await prismaPasswordAuthRepository.changeOwnPassword({
      currentUser,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      ipAddress: getClientIpAddress(request),
    });

    return dataResponse(result);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSWORD_CHANGE_UNAVAILABLE",
      "パスワードを変更できませんでした。",
    );
  }
}
