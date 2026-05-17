import { getClientIpAddress } from "@/app/api/_shared/request-context";
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

function getRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost ?? request.headers.get("host")?.trim();

  if (!host) {
    return requestUrl.origin;
  }

  return `${forwardedProtocol ?? requestUrl.protocol.replace(":", "")}://${host}`;
}
