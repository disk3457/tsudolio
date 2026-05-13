import { createDashboardUseCases } from "@/application/dashboard/use-cases";
import { prismaDashboardRepository } from "@/infrastructure/prisma/dashboard-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dashboardUseCases = createDashboardUseCases(prismaDashboardRepository);

export async function GET() {
  try {
    const snapshot = await dashboardUseCases.getDashboardSnapshot();

    return dataResponse(snapshot);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "DASHBOARD_DATA_UNAVAILABLE",
      "ダッシュボードデータを処理できませんでした。",
    );
  }
}
