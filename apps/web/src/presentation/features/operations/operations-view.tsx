"use client";

import type { FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  FileDown,
  History,
  RefreshCw,
  Save,
  ServerCog,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
  XCircle,
} from "lucide-react";
import type {
  OperationAuditEventSummary,
  OperationHealthCheck,
  OperationHealthStatus,
  OperationMetric,
  OperationsSnapshot,
} from "@/application/operations/types";
import { EmptyState } from "@/presentation/components/empty-state";
import {
  tenantTypeOptions,
  timezoneOptions,
} from "@/presentation/features/operations/form-state";
import { useOperationsConsole } from "@/presentation/features/operations/use-operations-console";
import {
  formatFullDateTime,
  formatNumber,
  getSeverityMeta,
} from "@/shared/formatters";

export function OperationsView() {
  const {
    exportPath,
    loadOperations,
    operationsState,
    saveTenantProfile,
    tenantForm,
    updateTenantForm,
  } = useOperationsConsole();
  const snapshot = operationsState.snapshot;
  const timezone = snapshot?.tenant.timezone ?? "Asia/Tokyo";

  async function submitTenantProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveTenantProfile();
  }

  return (
    <section className="viewStack operationsWorkspace">
      <div className="viewToolbar">
        <div>
          <p className="sectionLabel">Operations</p>
          <h2>運用管理コンソール</h2>
        </div>
        <div className="toolbarActions">
          <a
            aria-label="運用データをJSONでエクスポート"
            className="textButton"
            href={exportPath}
          >
            <FileDown aria-hidden="true" size={17} />
            <span>JSON</span>
          </a>
          <button
            aria-label="運用管理データを更新"
            className="iconButton"
            onClick={() => void loadOperations()}
            title="更新"
            type="button"
          >
            <RefreshCw aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      {operationsState.message && (
        <div
          className={`viewAlert ${
            operationsState.status === "ready" ? "success" : ""
          }`}
          role="status"
        >
          <AlertCircle aria-hidden="true" size={18} />
          <p>{operationsState.message}</p>
        </div>
      )}

      <div className="operationsStats" aria-label="運用指標">
        {(snapshot?.metrics ?? createLoadingMetrics()).map((metric) => (
          <OperationMetricCard key={metric.key} metric={metric} />
        ))}
      </div>

      <div className="operationsGrid">
        <section className="panel operationsTenantPanel">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">Tenant</p>
              <h2>テナント基本情報</h2>
            </div>
            <Building2 aria-hidden="true" className="panelIcon" size={21} />
          </div>

          {snapshot ? (
            <form className="scheduleForm" onSubmit={submitTenantProfile}>
              <div className="formGrid">
                <label className="fieldControl">
                  <span>テナントコード</span>
                  <input readOnly value={snapshot.tenant.code} />
                </label>
                <label className="fieldControl wide">
                  <span>正式名称</span>
                  <input
                    onChange={(event) =>
                      updateTenantForm("name", event.target.value)
                    }
                    required
                    value={tenantForm.name}
                  />
                </label>
                <label className="fieldControl">
                  <span>種別</span>
                  <select
                    onChange={(event) =>
                      updateTenantForm(
                        "type",
                        event.target.value as typeof tenantForm.type,
                      )
                    }
                    value={tenantForm.type}
                  >
                    {tenantTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fieldControl wide">
                  <span>表示名</span>
                  <input
                    onChange={(event) =>
                      updateTenantForm("displayName", event.target.value)
                    }
                    value={tenantForm.displayName}
                  />
                </label>
                <label className="fieldControl">
                  <span>タイムゾーン</span>
                  <select
                    onChange={(event) =>
                      updateTenantForm("timezone", event.target.value)
                    }
                    value={tenantForm.timezone}
                  >
                    {timezoneOptions.includes(tenantForm.timezone) ? null : (
                      <option value={tenantForm.timezone}>
                        {tenantForm.timezone}
                      </option>
                    )}
                    {timezoneOptions.map((timezoneOption) => (
                      <option key={timezoneOption} value={timezoneOption}>
                        {timezoneOption}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="formFooter">
                <p>
                  更新日時{" "}
                  {formatFullDateTime(snapshot.tenant.updatedAt, timezone)}
                </p>
                <button
                  className="textButton primary"
                  disabled={operationsState.status === "saving"}
                  type="submit"
                >
                  <Save aria-hidden="true" size={17} />
                  <span>
                    {operationsState.status === "saving" ? "保存中" : "保存"}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <EmptyState
              description="運用管理データを読み込めませんでした。"
              title={
                operationsState.status === "loading"
                  ? "テナント情報を取得しています"
                  : "表示できるテナント情報がありません"
              }
            />
          )}
        </section>

        <OperationBackupPanel snapshot={snapshot} />

        <section className="panel operationsHealthPanel">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">Health</p>
              <h2>ヘルスチェック</h2>
            </div>
            <ShieldCheck aria-hidden="true" className="panelIcon" size={21} />
          </div>

          <div className="operationHealthList">
            {(snapshot?.healthChecks ?? []).map((check) => (
              <OperationHealthItem
                check={check}
                key={check.key}
                timezone={timezone}
              />
            ))}
            {operationsState.status === "loading" && (
              <EmptyState
                description="各種チェックを集計しています。"
                title="確認中"
              />
            )}
          </div>
        </section>

        <section className="panel operationsEventsPanel">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">Audit</p>
              <h2>最近の運用イベント</h2>
            </div>
            <History aria-hidden="true" className="panelIcon" size={21} />
          </div>

          <div className="operationEventList">
            {(snapshot?.recentEvents ?? []).map((event) => (
              <OperationEventItem
                event={event}
                key={event.id}
                timezone={timezone}
              />
            ))}
            {snapshot && snapshot.recentEvents.length === 0 && (
              <EmptyState
                description="テナント設定や管理系の監査イベントはまだありません。"
                title="運用イベントなし"
              />
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function OperationMetricCard({ metric }: { metric: OperationMetric }) {
  return (
    <article className={`operationMetric ${metric.tone}`}>
      <div>
        <span>{metric.label}</span>
        <strong>
          {formatNumber(metric.value)}
          <small>{metric.unit}</small>
        </strong>
        <p>{metric.detail}</p>
      </div>
      <OperationMetricIcon metricKey={metric.key} />
    </article>
  );
}

function OperationBackupPanel({
  snapshot,
}: {
  snapshot: OperationsSnapshot | null;
}) {
  return (
    <section className="panel operationsBackupPanel">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">Export</p>
          <h2>運用エクスポート</h2>
        </div>
        <Database aria-hidden="true" className="panelIcon" size={21} />
      </div>

      {snapshot ? (
        <div className="operationBackupBody">
          <div className="operationBackupMetric">
            <span>対象レコード</span>
            <strong>
              {formatNumber(snapshot.backup.estimatedRecordCount)}
              <small>件</small>
            </strong>
          </div>
          <code>{snapshot.backup.filename}</code>
          <div className="operationBackupIncludes">
            {snapshot.backup.includes.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <a
            aria-label="運用データをJSONでダウンロード"
            className="textButton primary"
            href={snapshot.backup.endpoint}
          >
            <FileDown aria-hidden="true" size={17} />
            <span>ダウンロード</span>
          </a>
        </div>
      ) : (
        <EmptyState
          description="エクスポート情報を取得できませんでした。"
          title="準備中"
        />
      )}
    </section>
  );
}

function OperationHealthItem({
  check,
  timezone,
}: {
  check: OperationHealthCheck;
  timezone: string;
}) {
  return (
    <article className={`operationHealthItem ${check.status.toLowerCase()}`}>
      <OperationHealthIcon status={check.status} />
      <div>
        <div className="operationHealthHeading">
          <strong>{check.label}</strong>
          <span>{getHealthLabel(check.status)}</span>
        </div>
        <p>{check.detail}</p>
        <small>
          {check.value} / {formatFullDateTime(check.checkedAt, timezone)}
        </small>
      </div>
    </article>
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

function OperationMetricIcon({ metricKey }: { metricKey: string }) {
  if (metricKey === "audit") {
    return <ShieldCheck aria-hidden="true" size={24} />;
  }

  if (metricKey === "content") {
    return <Database aria-hidden="true" size={24} />;
  }

  if (metricKey === "facilities") {
    return <Building2 aria-hidden="true" size={24} />;
  }

  if (metricKey === "identity") {
    return <UsersRound aria-hidden="true" size={24} />;
  }

  if (metricKey === "permissions") {
    return <ServerCog aria-hidden="true" size={24} />;
  }

  if (metricKey === "schedule") {
    return <Clock3 aria-hidden="true" size={24} />;
  }

  if (metricKey === "workflow") {
    return <Activity aria-hidden="true" size={24} />;
  }

  return <ServerCog aria-hidden="true" size={24} />;
}

function OperationHealthIcon({ status }: { status: OperationHealthStatus }) {
  if (status === "OK") {
    return <CheckCircle2 aria-hidden="true" size={19} />;
  }

  if (status === "CRITICAL") {
    return <XCircle aria-hidden="true" size={19} />;
  }

  return <TriangleAlert aria-hidden="true" size={19} />;
}

function getHealthLabel(status: OperationHealthStatus) {
  if (status === "OK") {
    return "OK";
  }

  if (status === "CRITICAL") {
    return "要対応";
  }

  return "確認";
}

function createLoadingMetrics(): OperationMetric[] {
  return [
    "identity",
    "permissions",
    "facilities",
    "workflow",
    "content",
    "audit",
  ].map((key) => ({
    detail: "取得中",
    key,
    label: "読み込み中",
    tone: "neutral",
    unit: "件",
    value: 0,
  }));
}
