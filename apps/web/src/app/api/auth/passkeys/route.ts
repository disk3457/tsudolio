import { getCurrentUserFromRequest } from "@/app/api/_shared/request-context";
import { prismaPasskeyRepository } from "@/infrastructure/prisma/passkey-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const result = await prismaPasskeyRepository.listPasskeys(currentUser);

    return dataResponse(result);
  } catch (error) {
    return passkeyErrorResponse(error);
  }
}

function passkeyErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "PASSKEY_UNAVAILABLE",
    "Passkey情報を処理できませんでした。",
  );
}
