import {
  getClientIpAddress,
  requirePermission,
} from "@/app/api/_shared/request-context";
import { parseAuthPolicyUpdateInput } from "@/application/security/auth-policy-validation";
import { permissions } from "@/application/security/permissions";
import { prismaAuthPolicyRepository } from "@/infrastructure/prisma/auth-policy-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const currentUser = await requirePermission(request, permissions.manageTenant);

    return dataResponse(
      await prismaAuthPolicyRepository.getAuthPolicy(currentUser),
    );
  } catch (error) {
    return applicationErrorResponse(
      error,
      "AUTH_POLICY_UNAVAILABLE",
      "認証ポリシーを処理できませんでした。",
    );
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await requirePermission(request, permissions.manageTenant);
    const input = parseAuthPolicyUpdateInput(
      await readRequestJson(
        request,
        "認証ポリシー更新データのJSONを読み取れませんでした。",
      ),
    );

    return dataResponse(
      await prismaAuthPolicyRepository.updateAuthPolicy({
        currentUser,
        ipAddress: getClientIpAddress(request),
        requirePasskeyForPrivilegedUsers:
          input.requirePasskeyForPrivilegedUsers,
      }),
    );
  } catch (error) {
    return applicationErrorResponse(
      error,
      "AUTH_POLICY_UPDATE_UNAVAILABLE",
      "認証ポリシーを更新できませんでした。",
    );
  }
}
