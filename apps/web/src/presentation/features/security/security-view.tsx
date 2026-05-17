"use client";

import {
  AlertCircle,
  CircleCheckBig,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  AuditEventFilterState,
  AuditEventSummary,
} from "@/application/audit/types";
import type { DashboardLoadState } from "@/application/dashboard/types";
import { EmptyState } from "@/presentation/components/empty-state";
import { securityItems } from "@/presentation/features/security/security-static-data";
import { useAuditEvents } from "@/presentation/features/security/use-audit-events";
import {
  formatDateTime,
  formatFullDateTime,
  getSeverityMeta,
} from "@/shared/formatters";

type UpdateAuditFilter = <Field extends keyof AuditEventFilterState>(
  field: Field,
  value: AuditEventFilterState[Field],
) => void;

const severityOptions: Array<{
  label: string;
  value: AuditEventFilterState["severity"];
}> = [
  { label: "すべて", value: "all" },
  { label: "緊急", value: "CRITICAL" },
  { label: "注意", value: "WARNING" },
  { label: "通知", value: "NOTICE" },
  { label: "情報", value: "INFO" },
];

const rangeOptions: Array<{
  label: string;
  value: AuditEventFilterState["range"];
}> = [
  { label: "24時間", value: "24h" },
  { label: "7日", value: "7d" },
  { label: "30日", value: "30d" },
  { label: "全期間", value: "all" },
];

export function SecurityView({
  dashboardState,
}: {
  dashboardState: DashboardLoadState;
}) {
  const {
    auditState,
    filters,
    loadAuditEvents,
    resetFilters,
    selectedEvent,
    selectedEventId,
    setSelectedEventId,
    updateFilter,
  } = useAuditEvents();
  const timezone =
    auditState.snapshot?.tenant.timezone ??
    dashboardState.snapshot?.tenant.timezone ??
    "Asia/Tokyo";
  const auditRows = auditState.snapshot?.events ?? [];
  const filterOptions = auditState.snapshot?.filterOptions ?? {
    actions: [],
    targetTypes: [],
  };
  const hasActiveFilters =
    Boolean(filters.query) ||
    filters.severity !== "all" ||
    filters.targetType !== "all" ||
    filters.action !== "all" ||
    filters.range !== "30d";

  return (
    <section className="viewGrid auditWorkspace">
      <section
        className="panel widePanel auditPanel"
        aria-labelledby="audit-heading"
      >
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">監査</p>
            <h2 id="audit-heading">監査イベント</h2>
          </div>
          <button
            aria-label="監査イベントを更新"
            className="iconButton"
            onClick={() => void loadAuditEvents()}
            title="監査イベントを更新"
            type="button"
          >
            <RefreshCw aria-hidden="true" size={18} />
          </button>
        </div>

        <AuditFilters
          actionOptions={filterOptions.actions}
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          resetFilters={resetFilters}
          targetTypeOptions={filterOptions.targetTypes}
          updateFilter={updateFilter}
        />

        {auditState.message && (
          <div className="viewAlert" role="alert">
            <AlertCircle aria-hidden="true" size={18} />
            <p>{auditState.message}</p>
          </div>
        )}

        <div className="auditLogSummary">
          <span>{auditState.snapshot?.total ?? auditRows.length} 件</span>
          <span>{filters.limit} 件まで表示</span>
        </div>

        {auditRows.length === 0 ? (
          <EmptyState
            description="条件に一致する監査イベントがありません。"
            title={
              auditState.status === "loading"
                ? "監査イベントを取得しています"
                : "表示できる監査イベントがありません"
            }
          />
        ) : (
          <div className="auditLogList">
            {auditRows.map((event) => (
              <AuditLogButton
                event={event}
                isSelected={event.id === selectedEventId}
                key={event.id}
                onSelect={setSelectedEventId}
                timezone={timezone}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel auditDetailPanel" aria-labelledby="detail-heading">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">詳細</p>
            <h2 id="detail-heading">イベント詳細</h2>
          </div>
          <History aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <AuditEventDetail event={selectedEvent} timezone={timezone} />
      </section>

      <section
        className="panel securityControlsPanel"
        aria-labelledby="control-heading"
      >
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">統制</p>
            <h2 id="control-heading">基本対策</h2>
          </div>
          <ShieldCheck aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <ul className="securityList">
          {securityItems.map((item) => (
            <li key={item}>
              <CircleCheckBig aria-hidden="true" size={17} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function AuditFilters({
  actionOptions,
  filters,
  hasActiveFilters,
  resetFilters,
  targetTypeOptions,
  updateFilter,
}: {
  actionOptions: string[];
  filters: AuditEventFilterState;
  hasActiveFilters: boolean;
  resetFilters: () => void;
  targetTypeOptions: string[];
  updateFilter: UpdateAuditFilter;
}) {
  return (
    <form className="auditFilters" onSubmit={(event) => event.preventDefault()}>
      <label className="fieldControl auditSearchControl">
        <span>検索</span>
        <div className="auditSearchInput">
          <Search aria-hidden="true" size={17} />
          <input
            onChange={(event) => updateFilter("query", event.currentTarget.value)}
            placeholder="操作・主体・対象・IP"
            value={filters.query}
          />
        </div>
      </label>

      <label className="fieldControl">
        <span>重要度</span>
        <select
          onChange={(event) =>
            updateFilter(
              "severity",
              event.currentTarget.value as AuditEventFilterState["severity"],
            )
          }
          value={filters.severity}
        >
          {severityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="fieldControl">
        <span>対象</span>
        <select
          onChange={(event) =>
            updateFilter("targetType", event.currentTarget.value)
          }
          value={filters.targetType}
        >
          <option value="all">すべて</option>
          {targetTypeOptions.map((targetType) => (
            <option key={targetType} value={targetType}>
              {getTargetTypeLabel(targetType)}
            </option>
          ))}
        </select>
      </label>

      <label className="fieldControl">
        <span>操作</span>
        <select
          onChange={(event) => updateFilter("action", event.currentTarget.value)}
          value={filters.action}
        >
          <option value="all">すべて</option>
          {actionOptions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </label>

      <label className="fieldControl">
        <span>期間</span>
        <select
          onChange={(event) =>
            updateFilter(
              "range",
              event.currentTarget.value as AuditEventFilterState["range"],
            )
          }
          value={filters.range}
        >
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        aria-label="絞り込みを解除"
        className="iconButton"
        disabled={!hasActiveFilters}
        onClick={resetFilters}
        title="絞り込みを解除"
        type="button"
      >
        <X aria-hidden="true" size={18} />
      </button>
    </form>
  );
}

function AuditLogButton({
  event,
  isSelected,
  onSelect,
  timezone,
}: {
  event: AuditEventSummary;
  isSelected: boolean;
  onSelect: (eventId: string) => void;
  timezone: string;
}) {
  const severity = getSeverityMeta(event.severity);

  return (
    <button
      aria-pressed={isSelected}
      className={`auditLogItem ${isSelected ? "active" : ""}`}
      onClick={() => onSelect(event.id)}
      type="button"
    >
      <time>{formatDateTime(event.createdAt, timezone)}</time>
      <span className="auditLogBody">
        <span className="auditTitleRow">
          <strong>{event.action}</strong>
          <span className={`severityBadge ${severity.level}`}>
            {severity.label}
          </span>
        </span>
        <span className="auditEventMeta">
          <span>{event.actor?.displayName ?? "システム"}</span>
          <span>{getTargetTypeLabel(event.targetType)}</span>
          {event.ipAddress && <span>{event.ipAddress}</span>}
        </span>
      </span>
    </button>
  );
}

function AuditEventDetail({
  event,
  timezone,
}: {
  event: AuditEventSummary | null;
  timezone: string;
}) {
  if (!event) {
    return (
      <EmptyState
        description="表示対象の監査イベントがありません。"
        title="詳細を表示できません"
      />
    );
  }

  const severity = getSeverityMeta(event.severity);
  const metadataText = formatMetadata(event.metadata);

  return (
    <div className="auditDetail">
      <div className="auditDetailHeader">
        <span className={`severityBadge ${severity.level}`}>{severity.label}</span>
        <h3>{event.action}</h3>
        <time>{formatFullDateTime(event.createdAt, timezone)}</time>
      </div>

      <dl className="auditDetailList">
        <div>
          <dt>操作主体</dt>
          <dd>{formatActor(event)}</dd>
        </div>
        <div>
          <dt>対象</dt>
          <dd>{getTargetTypeLabel(event.targetType)}</dd>
        </div>
        <div>
          <dt>対象ID</dt>
          <dd>{event.targetId ?? "なし"}</dd>
        </div>
        <div>
          <dt>IPアドレス</dt>
          <dd>{event.ipAddress ?? "なし"}</dd>
        </div>
      </dl>

      <div className="auditMetadataBlock">
        <h3>メタデータ</h3>
        {metadataText ? (
          <pre>{metadataText}</pre>
        ) : (
          <p className="auditMetadataEmpty">なし</p>
        )}
      </div>
    </div>
  );
}

function formatActor(event: AuditEventSummary) {
  if (!event.actor) {
    return "システム";
  }

  return `${event.actor.displayName} / ${event.actor.email}`;
}

function formatMetadata(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.stringify(value, null, 2);
}

function getTargetTypeLabel(targetType: string) {
  const labels: Record<string, string> = {
    auth_identity: "認証ID",
    calendar_event: "予定",
    document: "文書",
    organization_unit: "組織",
    tenant: "テナント",
    user: "利用者",
    workflow_request: "申請",
  };

  return labels[targetType] ?? targetType;
}
