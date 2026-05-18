import {
  getClientIpAddress,
  getCurrentUserFromRequest,
} from "@/app/api/_shared/request-context";
import { prismaPasskeyRepository } from "@/infrastructure/prisma/passkey-repository";
import {
  applicationErrorResponse,
  dataResponse,
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
