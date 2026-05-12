import type { DashboardSnapshot } from "@/features/dashboard/types";
import { EmptyState } from "@/components/empty-state";
import {
  formatTime,
  getSeverityMeta,
} from "@/lib/formatters";

type AuditEventStatus = "loading" | "ready" | "error";

export function AuditEventList({
  emptyDescription,
  rows,
  status,
  timezone,
}: {
  emptyDescription: string;
  rows: DashboardSnapshot["securityEvents"];
  status: AuditEventStatus;
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
