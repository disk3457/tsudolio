import {
  getClientIpAddress,
  getCurrentUserFromRequest,
  requireRecentStepUp,
} from "@/app/api/_shared/request-context";
import { parsePasskeyUpdateInput } from "@/application/security/passkey-validation";
import { prismaPasskeyRepository } from "@/infrastructure/prisma/passkey-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    passkeyId: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    requireRecentStepUp(request);
    const { passkeyId } = await context.params;
    const result = await prismaPasskeyRepository.deletePasskey({
      currentUser,
      passkeyId,
      ipAddress: getClientIpAddress(request),
    });

    return dataResponse(result);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSKEY_DELETE_UNAVAILABLE",
      "Passkeyを削除できませんでした。",
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    requireRecentStepUp(request);
    const { passkeyId } = await context.params;
    const input = parsePasskeyUpdateInput(
      await readRequestJson(request, "Passkey更新データのJSONを読み取れませんでした。"),
    );
    const result = await prismaPasskeyRepository.updatePasskey({
      currentUser,
      passkeyId,
      name: input.name,
      ipAddress: getClientIpAddress(request),
    });

    return dataResponse(result);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "PASSKEY_UPDATE_UNAVAILABLE",
      "Passkeyを更新できませんでした。",
    );
  }
}
