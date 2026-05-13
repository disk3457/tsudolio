import { createDashboardUseCases } from "@/application/dashboard/use-cases";
import { prismaDashboardRepository } from "@/infrastructure/prisma/dashboard-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";
import { getTenantCodeFromRequest } from "@/app/api/_shared/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dashboardUseCases = createDashboardUseCases(prismaDashboardRepository);

export async function GET(request: Request) {
  try {
    const snapshot = await dashboardUseCases.getDashboardSnapshot(
      getTenantCodeFromRequest(request) ?? undefined,
    );

    return dataResponse(snapshot);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "DASHBOARD_DATA_UNAVAILABLE",
      "ダッシュボードデータを処理できませんでした。",
    );
  }
}
