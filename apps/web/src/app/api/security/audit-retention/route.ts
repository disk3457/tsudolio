import { parseAuditRetentionPolicyInput } from "@/application/audit/audit-retention-validation";
import { createAuditUseCases } from "@/application/audit/use-cases";
import { permissions } from "@/application/security/permissions";
import {
  getClientIpAddress,
  requirePermission,
  requireRecentStepUp,
} from "@/app/api/_shared/request-context";
import { prismaAuditEventRepository } from "@/infrastructure/prisma/audit-event-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const auditUseCases = createAuditUseCases(prismaAuditEventRepository);

export async function GET(request: Request) {
  try {
    const currentUser = await requirePermission(request, permissions.manageTenant);

    return dataResponse(
      await auditUseCases.getAuditRetentionPolicy(currentUser),
    );
  } catch (error) {
    return applicationErrorResponse(
      error,
      "AUDIT_RETENTION_UNAVAILABLE",
      "監査ログ保持設定を処理できませんでした。",
    );
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await requirePermission(request, permissions.manageTenant);
    requireRecentStepUp(request);
    const input = parseAuditRetentionPolicyInput(
      await readRequestJson(
        request,
        "監査ログ保持設定データのJSONを読み取れませんでした。",
      ),
    );

    return dataResponse(
      await auditUseCases.updateAuditRetentionPolicy({
        currentUser,
        ipAddress: getClientIpAddress(request),
        retentionDays: input.retentionDays,
      }),
    );
  } catch (error) {
    return applicationErrorResponse(
      error,
      "AUDIT_RETENTION_UPDATE_UNAVAILABLE",
      "監査ログ保持設定を更新できませんでした。",
    );
  }
}
