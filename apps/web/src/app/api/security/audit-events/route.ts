import { parseAuditEventQuery } from "@/application/audit/audit-query";
import { createAuditUseCases } from "@/application/audit/use-cases";
import { permissions } from "@/application/security/permissions";
import { requirePermission } from "@/app/api/_shared/request-context";
import { prismaAuditEventRepository } from "@/infrastructure/prisma/audit-event-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const auditUseCases = createAuditUseCases(prismaAuditEventRepository);

export async function GET(request: Request) {
  try {
    const currentUser = await requirePermission(request, permissions.manageTenant);
    const url = new URL(request.url);
    const snapshot = await auditUseCases.getAuditEventSnapshot(
      currentUser.tenantCode,
      parseAuditEventQuery(url.searchParams),
    );

    return dataResponse(snapshot);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "AUDIT_EVENTS_UNAVAILABLE",
      "監査イベントを処理できませんでした。",
    );
  }
}
