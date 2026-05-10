import {
  Bell,
  CalendarDays,
  Clock3,
  LockKeyhole,
  Settings,
  Smartphone,
} from "lucide-react";
import { AuditEventList } from "@/features/workspace/components/audit-event-list";
import { DataStatusNotice } from "@/features/workspace/components/data-status-notice";
import { EmptyState } from "@/features/workspace/components/empty-state";
import {
  defaultModulePresentation,
  fallbackModules,
  modulePresentation,
} from "@/features/workspace/data/dashboard";
import type {
  DashboardLoadState,
  ViewKey,
} from "@/features/workspace/types";
import {
  formatDue,
  formatNumber,
  formatTime,
  formatTimelineMeta,
  getPriorityMeta,
} from "@/features/workspace/utils/formatters";

export function DashboardView({
  dashboardState,
  setActiveView,
}: {
  dashboardState: DashboardLoadState;
  setActiveView: (view: ViewKey) => void;
}) {
  const snapshot = dashboardState.snapshot;
  const timezone = snapshot?.tenant.timezone ?? "Asia/Tokyo";
  const metricCards = [
    {
      label: "利用中ユーザー",
      value:
        snapshot === null
          ? dashboardState.status === "loading"
            ? "取得中"
            : "未取得"
          : formatNumber(snapshot.metrics.activeUsers),
    },
    {
      label: "承認待ち",
      value:
        snapshot === null
          ? dashboardState.status === "loading"
            ? "取得中"
            : "未取得"
          : formatNumber(snapshot.metrics.pendingApprovals),
    },
    {
      label: "監査イベント",
      value:
        snapshot === null
          ? dashboardState.status === "loading"
            ? "取得中"
            : "未取得"
          : formatNumber(snapshot.metrics.auditEvents),
    },
    {
      label: "未読通知",
      value:
        snapshot === null
          ? dashboardState.status === "loading"
            ? "取得中"
            : "未取得"
          : formatNumber(snapshot.metrics.unreadNotifications),
    },
  ];
  const moduleRows = snapshot?.modules ?? fallbackModules;
  const timelineRows = snapshot?.timeline ?? [];
  const approvalRows = snapshot?.approvals ?? [];
  const securityRows = snapshot?.securityEvents ?? [];

  return (
    <>
      <DataStatusNotice dashboardState={dashboardState} />

      <section className="statusStrip" aria-label="システム概要">
        {metricCards.map((metric) => (
          <div key={metric.label}>
            <p className="metricLabel">{metric.label}</p>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </section>

      <section className="moduleGrid" aria-label="主要機能">
        {moduleRows.map((module) => {
          const presentation = modulePresentation[module.key] ?? defaultModulePresentation;
          const Icon = presentation.icon;

          return (
            <button
              aria-label={`${module.title}を開く`}
              className={`moduleCard ${presentation.tone}`}
              key={module.key}
              onClick={() => setActiveView(presentation.target)}
              type="button"
            >
              <div className="moduleHeader">
                <div className="moduleIcon">
                  <Icon aria-hidden="true" size={22} />
                </div>
                <span>{module.status}</span>
              </div>
              <p className="moduleTitle">{presentation.label}</p>
              <h2>{module.title}</h2>
              <p>{module.summary}</p>
            </button>
          );
        })}
      </section>

      <section className="contentGrid">
        <section className="panel schedulePanel" aria-labelledby="schedule-heading">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">直近7日</p>
              <h2 id="schedule-heading">予定</h2>
            </div>
            <button
              className="textButton"
              onClick={() => setActiveView("schedule")}
              type="button"
            >
              <CalendarDays aria-hidden="true" size={17} />
              新規予定
            </button>
          </div>
          <div className="timeline">
            {timelineRows.length === 0 && (
              <EmptyState
                title={
                  dashboardState.status === "loading"
                    ? "予定を取得しています"
                    : "表示できる予定がありません"
                }
                description="API接続後、今後7日間の予定がここに並びます。"
              />
            )}
            {timelineRows.map((item) => (
              <article className="timelineItem" key={`${item.startsAt}-${item.title}`}>
                <time>{formatTime(item.startsAt, timezone)}</time>
                <div>
                  <h3>{item.title}</h3>
                  <p>{formatTimelineMeta(item)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel approvalPanel" aria-labelledby="approval-heading">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">ワークフロー</p>
              <h2 id="approval-heading">承認待ち</h2>
            </div>
            <button className="iconButton" aria-label="承認設定" type="button">
              <Settings aria-hidden="true" size={18} />
            </button>
          </div>
          <div className="approvalList">
            {approvalRows.length === 0 && (
              <EmptyState
                title={
                  dashboardState.status === "loading"
                    ? "承認待ちを取得しています"
                    : "承認待ちはありません"
                }
                description="API接続後、対応が必要な申請がここに表示されます。"
              />
            )}
            {approvalRows.map((approval) => {
              const priority = getPriorityMeta(approval.priority);

              return (
                <article className="approvalItem" key={approval.title}>
                  <div>
                    <h3>{approval.title}</h3>
                    <p>{approval.owner ?? approval.category}</p>
                  </div>
                  <div className="approvalMeta">
                    <span className={`riskBadge ${priority.level}`}>
                      {priority.label}
                    </span>
                    <time>{formatDue(approval.dueAt, timezone)}</time>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel securityPanel" aria-labelledby="security-heading">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">セキュリティ</p>
              <h2 id="security-heading">直近の監査</h2>
            </div>
            <LockKeyhole aria-hidden="true" className="panelIcon" size={21} />
          </div>
          <AuditEventList
            emptyDescription="API接続後、直近の監査イベントがここに表示されます。"
            rows={securityRows}
            status={dashboardState.status}
            timezone={timezone}
          />
        </section>

        <section className="panel mobilePanel" aria-labelledby="mobile-heading">
          <div className="mobileVisual">
            <Smartphone aria-hidden="true" size={30} />
            <div>
              <p className="sectionLabel">PWA対応</p>
              <h2 id="mobile-heading">スマホでも使いやすく</h2>
            </div>
          </div>
          <div className="mobileStats">
            <span>
              <Clock3 aria-hidden="true" size={16} />
              オフライン起動に対応予定
            </span>
            <span>
              <Bell aria-hidden="true" size={16} />
              通知連携を前提に設計
            </span>
          </div>
        </section>
      </section>
    </>
  );
}
