"use client";

import Image from "next/image";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
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

const modules = [
  {
    title: "予定・施設予約",
    label: "スケジュール",
    summary: "本日の予定 18 件、会議室予約 7 件",
    status: "稼働中",
    icon: CalendarDays,
    tone: "blue",
    target: "schedule" as const,
  },
  {
    title: "掲示・回覧",
    label: "お知らせ",
    summary: "未読 4 件、要確認 2 件",
    status: "確認あり",
    icon: MessageSquareText,
    tone: "cyan",
    target: "dashboard" as const,
  },
  {
    title: "申請・承認",
    label: "ワークフロー",
    summary: "承認待ち 11 件、差戻し 1 件",
    status: "対応必要",
    icon: ClipboardList,
    tone: "rose",
    target: "dashboard" as const,
  },
  {
    title: "文書管理",
    label: "ファイル共有",
    summary: "共有文書 234 件、保管期限確認 6 件",
    status: "管理中",
    icon: FileText,
    tone: "sky",
    target: "documents" as const,
  },
];

const timeline = [
  {
    time: "09:00",
    title: "災害対策連絡会",
    meta: "第2会議室 / 総務課",
  },
  {
    time: "10:30",
    title: "院内設備点検",
    meta: "施設管理 / 立会 2 名",
  },
  {
    time: "13:00",
    title: "稟議レビュー",
    meta: "電子決裁 / 承認者 3 名",
  },
  {
    time: "15:30",
    title: "情報セキュリティ確認",
    meta: "管理者 / 監査ログ確認",
  },
];

const approvals = [
  {
    title: "個人情報取扱区域への入室申請",
    owner: "医事課",
    due: "本日 17:00",
    level: "high",
    levelLabel: "重要",
  },
  {
    title: "庁外会議用端末の持出申請",
    owner: "防災安全課",
    due: "明日 12:00",
    level: "medium",
    levelLabel: "通常",
  },
  {
    title: "新規委託先アカウント発行",
    owner: "情報政策課",
    due: "5月13日",
    level: "high",
    levelLabel: "重要",
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

const auditEvents = [
  ["08:52", "多要素認証設定を更新", "システム管理者 / 192.0.2.24"],
  ["09:18", "共有文書の閲覧権限を変更", "情報政策課 / 文書ID DOC-1042"],
  ["10:04", "庁外端末持出申請を承認", "防災安全課 / ワークフロー WF-982"],
  ["11:22", "休職者アカウントを停止", "人事 / 利用者ID U-4401"],
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
  const activeItem = navItems.find((item) => item.key === activeView) ?? navItems[0];

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
            <p className="eyebrow">デモ市総合病院 / 業務ポータル</p>
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

        {activeView === "dashboard" && <DashboardView setActiveView={setActiveView} />}
        {activeView === "schedule" && <ScheduleView />}
        {activeView === "organization" && <OrganizationView />}
        {activeView === "documents" && <DocumentsView />}
        {activeView === "security" && <SecurityView />}
        {activeView === "settings" && <SettingsView />}
      </section>
    </main>
  );
}

function DashboardView({ setActiveView }: { setActiveView: (view: ViewKey) => void }) {
  return (
    <>
      <section className="statusStrip" aria-label="システム概要">
        <div>
          <p className="metricLabel">利用中ユーザー</p>
          <strong>1,248</strong>
        </div>
        <div>
          <p className="metricLabel">承認待ち</p>
          <strong>11</strong>
        </div>
        <div>
          <p className="metricLabel">監査イベント</p>
          <strong>3,924</strong>
        </div>
        <div>
          <p className="metricLabel">スマホ利用率</p>
          <strong>62%</strong>
        </div>
      </section>

      <section className="moduleGrid" aria-label="主要機能">
        {modules.map((module) => {
          const Icon = module.icon;

          return (
            <button
              aria-label={`${module.title}を開く`}
              className={`moduleCard ${module.tone}`}
              key={module.title}
              onClick={() => setActiveView(module.target)}
              type="button"
            >
              <div className="moduleHeader">
                <div className="moduleIcon">
                  <Icon aria-hidden="true" size={22} />
                </div>
                <span>{module.status}</span>
              </div>
              <p className="moduleTitle">{module.label}</p>
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
              <p className="sectionLabel">本日</p>
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
            {timeline.map((item) => (
              <article className="timelineItem" key={`${item.time}-${item.title}`}>
                <time>{item.time}</time>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.meta}</p>
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
            {approvals.map((approval) => (
              <article className="approvalItem" key={approval.title}>
                <div>
                  <h3>{approval.title}</h3>
                  <p>{approval.owner}</p>
                </div>
                <div className="approvalMeta">
                  <span className={`riskBadge ${approval.level}`}>
                    {approval.levelLabel}
                  </span>
                  <time>{approval.due}</time>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel securityPanel" aria-labelledby="security-heading">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">セキュリティ</p>
              <h2 id="security-heading">基本対策</h2>
            </div>
            <LockKeyhole aria-hidden="true" className="panelIcon" size={21} />
          </div>
          <ul className="securityList">
            {securityItems.map((item) => (
              <li key={item}>
                <ShieldCheck aria-hidden="true" size={17} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
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

function SecurityView() {
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
        <div className="auditList">
          {auditEvents.map(([time, title, detail]) => (
            <article className="auditItem" key={`${time}-${title}`}>
              <time>{time}</time>
              <div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
            </article>
          ))}
        </div>
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
