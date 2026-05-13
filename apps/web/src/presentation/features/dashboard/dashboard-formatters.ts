import type { DashboardSnapshot } from "@/application/dashboard/types";

export function formatTimelineMeta(item: DashboardSnapshot["timeline"][number]) {
  const meta = [item.location, item.organizationUnit].filter(Boolean);

  return meta.length > 0 ? meta.join(" / ") : "場所未設定";
}
