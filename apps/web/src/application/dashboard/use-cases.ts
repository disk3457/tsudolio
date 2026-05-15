import type { DashboardSnapshot } from "@/application/dashboard/types";

export type DashboardRepository = {
  getDashboardSnapshot: (tenantCode: string) => Promise<DashboardSnapshot>;
};

export function createDashboardUseCases(repository: DashboardRepository) {
  return {
    getDashboardSnapshot: repository.getDashboardSnapshot,
  };
}
