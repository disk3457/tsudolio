import { History } from "lucide-react";
import type { OperationAuditEventSummary } from "@/application/operations/types";
import { EmptyState } from "@/presentation/components/empty-state";
import { formatFullDateTime, getSeverityMeta } from "@/shared/formatters";

export function OperationEventsPanel({
  events,
  hasSnapshot,
  timezone,
}: {
  events: OperationAuditEventSummary[];
  hasSnapshot: boolean;
  timezone: string;
}) {
  return (
    <section className="panel operationsEventsPanel">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">Audit</p>
          <h2>最近の運用イベント</h2>
        </div>
        <History aria-hidden="true" className="panelIcon" size={21} />
      </div>

      <div className="operationEventList">
        {events.map((event) => (
          <OperationEventItem
            event={event}
            key={event.id}
            timezone={timezone}
          />
        ))}
        {hasSnapshot && events.length === 0 && (
          <EmptyState
            description="テナント設定や管理系の監査イベントはまだありません。"
            title="運用イベントなし"
          />
        )}
      </div>
    </section>
  );
}

function OperationEventItem({
  event,
  timezone,
}: {
  event: OperationAuditEventSummary;
  timezone: string;
}) {
  const severity = getSeverityMeta(event.severity);

  return (
    <article className="operationEventItem">
      <span className={`operationSeverity ${severity.level}`}>
        {severity.label}
      </span>
      <div>
        <strong>{event.action}</strong>
        <p>
          {event.actor ?? "システム"} / {event.targetType}
          {event.targetId ? `:${event.targetId}` : ""}
        </p>
      </div>
      <time dateTime={event.createdAt}>
        {formatFullDateTime(event.createdAt, timezone)}
      </time>
    </article>
  );
}
