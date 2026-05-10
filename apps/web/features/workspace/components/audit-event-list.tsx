import type { DashboardSnapshot } from "@/lib/dashboard-types";
import { EmptyState } from "@/features/workspace/components/empty-state";
import type { DashboardLoadState } from "@/features/workspace/types";
import {
  formatTime,
  getSeverityMeta,
} from "@/features/workspace/utils/formatters";

export function AuditEventList({
  emptyDescription,
  rows,
  status,
  timezone,
}: {
  emptyDescription: string;
  rows: DashboardSnapshot["securityEvents"];
  status: DashboardLoadState["status"];
  timezone: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        description={emptyDescription}
        title={
          status === "loading"
            ? "監査イベントを取得しています"
            : "表示できる監査イベントがありません"
        }
      />
    );
  }

  return (
    <div className="auditList">
      {rows.map((event) => {
        const severity = getSeverityMeta(event.severity);

        return (
          <article className="auditItem" key={`${event.createdAt}-${event.action}`}>
            <time>{formatTime(event.createdAt, timezone)}</time>
            <div>
              <div className="auditTitleRow">
                <h3>{event.action}</h3>
                <span className={`severityBadge ${severity.level}`}>
                  {severity.label}
                </span>
              </div>
              <p>{event.actor ?? "システム"}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
