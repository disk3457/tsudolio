"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  CircleCheckBig,
  ClipboardList,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  History,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareText,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UsersRound,
} from "lucide-react";
import type {
  DashboardApiResponse,
  DashboardSnapshot,
} from "@/lib/dashboard-types";

type ViewKey =
  | "dashboard"
  | "schedule"
  | "organization"
  | "documents"
  | "security"
  | "settings";

type NavItem = {
  key: ViewKey;
  title: string;
  description: string;
  label: string;
  icon: LucideIcon;
};

type DashboardLoadState = {
  snapshot: DashboardSnapshot | null;
  source: "database" | "fallback";
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

type ModulePresentation = {
  icon: LucideIcon;
  label: string;
  target: ViewKey;
  tone: "blue" | "cyan" | "rose" | "sky";
};

const navItems: NavItem[] = [
  {
    key: "dashboard",
    title: "業務ダッシュボード",
    description: "組織全体の予定、承認、通知、セキュリティ状況を一画面で確認します。",
    label: "ダッシュボード",
    icon: LayoutDashboard,
  },
  {
    key: "schedule",
    title: "予定・施設予約",
    description: "個人、部署、施設の予定を同じ流れで管理します。",
    label: "予定",
    icon: CalendarDays,
  },
  {
    key: "organization",
    title: "組織・利用者",
    description: "自治体、病院、民間企業に対応できる組織階層と権限を整理します。",
    label: "組織",
    icon: UsersRound,
  },
  {
    key: "documents",
    title: "文書管理",
    description: "共有文書、規程、申請添付を版管理と保管期限つきで扱います。",
    label: "文書",
    icon: FileText,
  },
  {
    key: "security",
    title: "セキュリティ",
    description: "監査ログ、権限、認証設定を運用者が追える形にします。",
    label: "セキュリティ",
    icon: ShieldCheck,
  },
  {
    key: "settings",
    title: "共通設定",
    description: "組織名、通知、保管ルールなど全体設定の入口です。",
    label: "設定",
    icon: Settings,
  },
];

const modulePresentation: Record<string, ModulePresentation> = {
  schedule: {
    icon: CalendarDays,
    label: "スケジュール",
    target: "schedule",
    tone: "blue",
  },
  notices: {
    icon: MessageSquareText,
    label: "お知らせ",
    target: "dashboard",
    tone: "cyan",
  },
  workflow: {
    icon: ClipboardList,
    label: "ワークフロー",
    target: "dashboard",
    tone: "rose",
  },
  documents: {
    icon: FileText,
    label: "ファイル共有",
    target: "documents",
    tone: "sky",
  },
};

const defaultModulePresentation: ModulePresentation = {
  icon: Database,
  label: "機能",
  target: "dashboard",
  tone: "blue",
};

const fallbackModules = [
  {
    key: "schedule",
    title: "予定・施設予約",
    summary: "DB接続後に予定と施設予約を表示します",
    status: "取得待ち",
  },
  {
    key: "notices",
    title: "掲示・回覧",
    summary: "DB接続後に有効な掲示と未読通知を表示します",
    status: "取得待ち",
  },
  {
    key: "workflow",
    title: "申請・承認",
    summary: "DB接続後に承認待ちと緊急申請を表示します",
    status: "取得待ち",
  },
  {
    key: "documents",
    title: "文書管理",
    summary: "DB接続後に文書台帳の件数を表示します",
    status: "取得待ち",
  },
];

const securityItems = [
  "管理者は多要素認証を必須化",
  "組織・部署単位でアクセス範囲を制御",
  "監査ログは改ざん検知を前提に保存",
  "リポジトリに秘密情報を含めない",
];

const scheduleDays = [
  {
    label: "今日",
    date: "5月9日",
    events: [
      ["09:00", "災害対策連絡会", "第2会議室"],
      ["11:00", "地域連携カンファレンス", "オンライン"],
      ["15:30", "監査ログ確認", "情報政策課"],
    ],
  },
  {
    label: "明日",
    date: "5月10日",
    events: [
      ["10:00", "定例部長会", "大会議室"],
      ["13:30", "外部委託レビュー", "第1会議室"],
    ],
  },
  {
    label: "今週",
    date: "5月11日から",
    events: [
      ["火 09:30", "電子決裁説明会", "研修室"],
      ["水 14:00", "感染対策委員会", "講堂"],
      ["金 16:00", "月次報告締切", "各部署"],
    ],
  },
];

const facilities = [
  { name: "第1会議室", status: "利用中", next: "13:00から空き", tone: "busy" },
  { name: "大会議室", status: "予約可", next: "終日 3 枠あり", tone: "open" },
  { name: "公用車 02", status: "確認中", next: "管理者承認待ち", tone: "wait" },
];

const departments = [
  {
    name: "総務課",
    type: "自治体",
    users: "82名",
    lead: "佐藤 課長",
    children: ["防災安全課", "情報政策課", "契約検査室"],
  },
  {
    name: "医療安全管理室",
    type: "病院",
    users: "36名",
    lead: "中村 室長",
    children: ["医事課", "看護部", "施設管理"],
  },
  {
    name: "コーポレート本部",
    type: "民間",
    users: "128名",
    lead: "田中 本部長",
    children: ["人事", "経理", "情報システム"],
  },
];

const roleAssignments = [
  {
    role: "システム管理者",
    scope: "全テナント設定",
    members: "4名",
    policy: "MFA必須 / 操作ログ常時記録",
  },
  {
    role: "部門管理者",
    scope: "所属組織と配下",
    members: "42名",
    policy: "利用者招待と施設予約を管理",
  },
  {
    role: "一般利用者",
    scope: "本人と所属部署",
    members: "1,202名",
    policy: "予定、掲示、申請を利用",
  },
];

const documentRows = [
  {
    title: "個人情報取扱マニュアル",
    area: "セキュリティ",
    owner: "情報政策課",
    version: "v3.2",
    retention: "2031年3月",
    status: "最新版",
  },
  {
    title: "災害時連絡体制",
    area: "BCP",
    owner: "防災安全課",
    version: "v1.8",
    retention: "常用",
    status: "回覧中",
  },
  {
    title: "設備点検報告書",
    area: "施設",
    owner: "施設管理",
    version: "v2.0",
    retention: "2029年5月",
    status: "承認待ち",
  },
  {
    title: "委託先アカウント一覧",
    area: "外部連携",
    owner: "情報システム",
    version: "v1.4",
    retention: "2027年12月",
    status: "要確認",
  },
];

const settingGroups = [
  {
    title: "組織プロファイル",
    icon: Building2,
    items: ["表示名: デモ市総合病院", "業種テンプレート: 自治体・医療併用", "標準タイムゾーン: Asia/Tokyo"],
  },
  {
    title: "通知",
    icon: Bell,
    items: ["承認期限前の通知を有効化", "重要掲示は既読確認を必須化", "スマホPWAの通知連携を準備中"],
  },
  {
    title: "保管ルール",
    icon: Database,
    items: ["監査ログ: 7年保管", "申請添付: 文書分類に連動", "削除操作は論理削除で記録"],
  },
];

export default function Home() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [dashboardState, setDashboardState] = useState<DashboardLoadState>({
    snapshot: null,
    source: "fallback",
    status: "loading",
    message: null,
    updatedAt: null,
  });
  const activeItem = navItems.find((item) => item.key === activeView) ?? navItems[0];
  const tenantName = dashboardState.snapshot?.tenant.name ?? "デモ市総合病院";

  useEffect(() => {
    let shouldIgnore = false;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });
        const body = (await response.json()) as DashboardApiResponse;

        if (!response.ok || !("data" in body)) {
          throw new Error(
            "message" in body ? body.message : "ダッシュボードデータを取得できませんでした",
          );
        }

        if (!shouldIgnore) {
          setDashboardState({
            snapshot: body.data,
            source: body.source,
            status: "ready",
            message: null,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        if (!shouldIgnore) {
          setDashboardState({
            snapshot: null,
            source: "fallback",
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "ダッシュボードデータを取得できませんでした",
            updatedAt: null,
          });
        }
      }
    }

    void loadDashboard();

    return () => {
      shouldIgnore = true;
    };
  }, []);

  return (
    <main className="appShell">
      <aside className="sidebar" aria-label="主要メニュー">
        <div className="brand">
          <div className="brandMark">
            <Image
              alt="Tsudolio ロゴ"
              className="brandLogo"
              height={48}
              src="/brand/tsudolio-logo-icon.png"
              width={48}
            />
          </div>
          <div>
            <p className="brandName">Tsudolio</p>
            <p className="brandSub">ツドリオ</p>
          </div>
        </div>

        <nav className="navList" aria-label="機能一覧">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                aria-label={item.label}
                aria-current={activeView === item.key ? "page" : undefined}
                className={`navItem ${activeView === item.key ? "active" : ""}`}
                key={item.key}
                onClick={() => setActiveView(item.key)}
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{tenantName} / 業務ポータル</p>
            <h1>{activeItem.title}</h1>
            <p className="topbarLead">{activeItem.description}</p>
          </div>
          <div className="topbarActions">
            <label className="searchBox">
              <Search aria-hidden="true" size={18} />
              <span className="srOnly">検索</span>
              <input placeholder="予定・文書・申請を検索" />
            </label>
            <button className="iconButton" aria-label="通知" type="button">
              <Bell aria-hidden="true" size={19} />
            </button>
          </div>
        </header>

        {activeView === "dashboard" && (
          <DashboardView dashboardState={dashboardState} setActiveView={setActiveView} />
        )}
        {activeView === "schedule" && <ScheduleView />}
        {activeView === "organization" && <OrganizationView />}
        {activeView === "documents" && <DocumentsView />}
        {activeView === "security" && (
          <SecurityView dashboardState={dashboardState} />
        )}
        {activeView === "settings" && <SettingsView />}
      </section>
    </main>
  );
}

function DashboardView({
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

function DataStatusNotice({
  dashboardState,
}: {
  dashboardState: DashboardLoadState;
}) {
  if (dashboardState.status === "ready") {
    return (
      <section className="dataNotice ready" aria-label="データ接続状態">
        <Database aria-hidden="true" size={19} />
        <div>
          <p className="sectionLabel">データベース連携</p>
          <h2>実データでダッシュボードを表示しています</h2>
          <p>
            {dashboardState.updatedAt === null
              ? "最新データを取得済みです。"
              : `${formatDateTime(dashboardState.updatedAt, dashboardState.snapshot?.tenant.timezone ?? "Asia/Tokyo")} 時点で更新`}
          </p>
        </div>
      </section>
    );
  }

  if (dashboardState.status === "loading") {
    return (
      <section className="dataNotice loading" aria-label="データ接続状態">
        <Database aria-hidden="true" size={19} />
        <div>
          <p className="sectionLabel">データベース連携</p>
          <h2>最新データを取得しています</h2>
          <p>予定、承認、通知、監査ログをAPIから読み込んでいます。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="dataNotice error" aria-label="データ接続状態">
      <AlertCircle aria-hidden="true" size={19} />
      <div>
        <p className="sectionLabel">データベース連携</p>
        <h2>DBデータを取得できませんでした</h2>
        <p>{dashboardState.message}</p>
      </div>
    </section>
  );
}

function EmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="emptyState">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function AuditEventList({
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatDue(value: string | null, timezone: string) {
  if (value === null) {
    return "期限なし";
  }

  return formatDateTime(value, timezone);
}

function formatTimelineMeta(item: DashboardSnapshot["timeline"][number]) {
  const meta = [item.location, item.organizationUnit].filter(Boolean);

  return meta.length > 0 ? meta.join(" / ") : "場所未設定";
}

function getPriorityMeta(priority: string) {
  if (priority === "URGENT" || priority === "HIGH") {
    return { label: "重要", level: "high" };
  }

  if (priority === "MEDIUM") {
    return { label: "通常", level: "medium" };
  }

  return { label: "低", level: "low" };
}

function getSeverityMeta(severity: string) {
  if (severity === "CRITICAL") {
    return { label: "緊急", level: "critical" };
  }

  if (severity === "WARNING") {
    return { label: "注意", level: "warning" };
  }

  return { label: "通知", level: "notice" };
}

function ScheduleView() {
  return (
    <section className="viewStack">
      <div className="viewToolbar" aria-label="予定操作">
        <div className="segmentedControl" aria-label="表示期間">
          <button className="active" type="button">今日</button>
          <button type="button">週</button>
          <button type="button">月</button>
        </div>
        <button className="textButton primary" type="button">
          <CalendarDays aria-hidden="true" size={17} />
          予定を登録
        </button>
      </div>

      <section className="scheduleBoard" aria-label="予定一覧">
        {scheduleDays.map((day) => (
          <article className="panel dayColumn" key={day.label}>
            <div className="panelHeader compact">
              <div>
                <p className="sectionLabel">{day.label}</p>
                <h2>{day.date}</h2>
              </div>
              <Clock3 aria-hidden="true" className="panelIcon" size={20} />
            </div>
            <div className="timeline">
              {day.events.map(([time, title, place]) => (
                <article className="timelineItem compact" key={`${day.label}-${time}`}>
                  <time>{time}</time>
                  <div>
                    <h3>{title}</h3>
                    <p>{place}</p>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="quickCards" aria-label="施設予約状況">
        {facilities.map((facility) => (
          <article className="panel facilityCard" key={facility.name}>
            <div>
              <p className="sectionLabel">施設予約</p>
              <h2>{facility.name}</h2>
              <p>{facility.next}</p>
            </div>
            <span className={`statusPill ${facility.tone}`}>{facility.status}</span>
          </article>
        ))}
      </section>
    </section>
  );
}

function OrganizationView() {
  return (
    <section className="viewGrid">
      <section className="panel widePanel" aria-labelledby="org-heading">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">組織階層</p>
            <h2 id="org-heading">複数業種に対応する部門モデル</h2>
          </div>
          <UsersRound aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <div className="orgGrid">
          {departments.map((department) => (
            <article className="orgCard" key={department.name}>
              <div className="orgCardHeader">
                <span>{department.type}</span>
                <strong>{department.users}</strong>
              </div>
              <h3>{department.name}</h3>
              <p>{department.lead}</p>
              <div className="chipList">
                {department.children.map((child) => (
                  <span key={child}>{child}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="role-heading">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">権限</p>
            <h2 id="role-heading">ロール設計</h2>
          </div>
          <KeyRound aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <div className="recordList">
          {roleAssignments.map((role) => (
            <article className="recordItem" key={role.role}>
              <div>
                <h3>{role.role}</h3>
                <p>{role.scope}</p>
              </div>
              <strong>{role.members}</strong>
              <span>{role.policy}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function DocumentsView() {
  return (
    <section className="viewStack">
      <div className="viewToolbar" aria-label="文書操作">
        <div className="segmentedControl" aria-label="文書分類">
          <button className="active" type="button">共有</button>
          <button type="button">規程</button>
          <button type="button">申請添付</button>
        </div>
        <button className="textButton primary" type="button">
          <FileCheck2 aria-hidden="true" size={17} />
          文書を登録
        </button>
      </div>

      <section className="panel tablePanel" aria-labelledby="document-heading">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">文書台帳</p>
            <h2 id="document-heading">共有文書</h2>
          </div>
          <FileText aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <div className="dataTable">
          <div className="dataRow heading">
            <span>文書名</span>
            <span>分類</span>
            <span>管理部署</span>
            <span>版</span>
            <span>保管期限</span>
            <span>状態</span>
          </div>
          {documentRows.map((document) => (
            <div className="dataRow" key={document.title}>
              <strong>{document.title}</strong>
              <span>{document.area}</span>
              <span>{document.owner}</span>
              <span>{document.version}</span>
              <span>{document.retention}</span>
              <span className="statusPill open">{document.status}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function SecurityView({
  dashboardState,
}: {
  dashboardState: DashboardLoadState;
}) {
  const timezone = dashboardState.snapshot?.tenant.timezone ?? "Asia/Tokyo";
  const securityRows = dashboardState.snapshot?.securityEvents ?? [];

  return (
    <section className="viewGrid">
      <section className="panel widePanel" aria-labelledby="audit-heading">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">監査</p>
            <h2 id="audit-heading">直近の監査イベント</h2>
          </div>
          <History aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <AuditEventList
          emptyDescription="DB接続後、管理操作や認証・権限変更の履歴がここに表示されます。"
          rows={securityRows}
          status={dashboardState.status}
          timezone={timezone}
        />
      </section>

      <section className="panel" aria-labelledby="control-heading">
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

function SettingsView() {
  return (
    <section className="settingsGrid" aria-label="共通設定">
      {settingGroups.map((group) => {
        const Icon = group.icon;

        return (
          <article className="panel settingCard" key={group.title}>
            <div className="panelHeader">
              <div>
                <p className="sectionLabel">設定</p>
                <h2>{group.title}</h2>
              </div>
              <Icon aria-hidden="true" className="panelIcon" size={21} />
            </div>
            <ul>
              {group.items.map((item) => (
                <li key={item}>
                  <CircleCheckBig aria-hidden="true" size={17} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
      <article className="panel settingCard actionCard">
        <div>
          <p className="sectionLabel">次の接続</p>
          <h2>認証と通知の外部連携</h2>
          <p>OIDC、メール、プッシュ通知を後続ステップで接続できる設計にします。</p>
        </div>
        <div className="actionRow">
          <button className="textButton" type="button">
            <SlidersHorizontal aria-hidden="true" size={17} />
            連携設定
          </button>
          <button className="textButton primary" type="button">
            <Send aria-hidden="true" size={17} />
            テスト通知
          </button>
        </div>
      </article>
    </section>
  );
}
