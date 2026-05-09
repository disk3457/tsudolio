import Image from "next/image";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  LockKeyhole,
  MessageSquareText,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from "lucide-react";

const modules = [
  {
    title: "Schedule",
    label: "予定・施設",
    summary: "本日の予定 18 件、会議室予約 7 件",
    status: "Operational",
    icon: CalendarDays,
    tone: "teal",
  },
  {
    title: "Circulars",
    label: "掲示・回覧",
    summary: "未読 4 件、要確認 2 件",
    status: "Review",
    icon: MessageSquareText,
    tone: "amber",
  },
  {
    title: "Workflow",
    label: "申請・承認",
    summary: "承認待ち 11 件、差戻し 1 件",
    status: "Attention",
    icon: ClipboardList,
    tone: "rose",
  },
  {
    title: "Documents",
    label: "文書・添付",
    summary: "共有文書 234 件、保管期限確認 6 件",
    status: "Managed",
    icon: FileText,
    tone: "indigo",
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
    level: "High",
  },
  {
    title: "庁外会議用端末の持出申請",
    owner: "防災安全課",
    due: "明日 12:00",
    level: "Medium",
  },
  {
    title: "新規委託先アカウント発行",
    owner: "情報政策課",
    due: "5月13日",
    level: "High",
  },
];

const securityItems = [
  "MFA required for administrators",
  "Tenant-scoped access policy",
  "Immutable audit event stream",
  "No secrets in repository",
];

export default function Home() {
  return (
    <main className="appShell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <div className="brandMark">
            <Image
              alt="Tsudolio logo"
              className="brandLogo"
              height={44}
              src="/brand/tsudolio-logo-icon.png"
              width={44}
            />
          </div>
          <div>
            <p className="brandName">Tsudolio</p>
            <p className="brandSub">ツドリオ</p>
          </div>
        </div>

        <nav className="navList" aria-label="Modules">
          {[
            ["Dashboard", CheckCircle2],
            ["Schedule", CalendarDays],
            ["Teams", UsersRound],
            ["Documents", FileText],
            ["Security", ShieldCheck],
            ["Settings", Settings],
          ].map(([item, Icon]) => (
            <a
              aria-label={item as string}
              className="navItem"
              href="#"
              key={item as string}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{item as string}</span>
            </a>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Tenant / Demo City General Hospital</p>
            <h1>Operations Dashboard</h1>
          </div>
          <div className="topbarActions">
            <label className="searchBox">
              <Search aria-hidden="true" size={18} />
              <span className="srOnly">Search</span>
              <input placeholder="Search" />
            </label>
            <button className="iconButton" aria-label="Notifications">
              <Bell aria-hidden="true" size={19} />
            </button>
          </div>
        </header>

        <section className="statusStrip" aria-label="System overview">
          <div>
            <p className="metricLabel">Active users</p>
            <strong>1,248</strong>
          </div>
          <div>
            <p className="metricLabel">Pending approvals</p>
            <strong>11</strong>
          </div>
          <div>
            <p className="metricLabel">Audit events</p>
            <strong>3,924</strong>
          </div>
          <div>
            <p className="metricLabel">Mobile sessions</p>
            <strong>62%</strong>
          </div>
        </section>

        <section className="moduleGrid" aria-label="Core modules">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <article className={`moduleCard ${module.tone}`} key={module.title}>
                <div className="moduleHeader">
                  <div className="moduleIcon">
                    <Icon aria-hidden="true" size={22} />
                  </div>
                  <span>{module.status}</span>
                </div>
                <p className="moduleTitle">{module.label}</p>
                <h2>{module.title}</h2>
                <p>{module.summary}</p>
              </article>
            );
          })}
        </section>

        <section className="contentGrid">
          <section className="panel schedulePanel" aria-labelledby="schedule-heading">
            <div className="panelHeader">
              <div>
                <p className="sectionLabel">Today</p>
                <h2 id="schedule-heading">Schedule</h2>
              </div>
              <button className="textButton">
                <CalendarDays aria-hidden="true" size={17} />
                New
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
                <p className="sectionLabel">Workflow</p>
                <h2 id="approval-heading">Approval Queue</h2>
              </div>
              <button className="iconButton" aria-label="Approval settings">
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
                    <span className={`riskBadge ${approval.level.toLowerCase()}`}>
                      {approval.level}
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
                <p className="sectionLabel">Security</p>
                <h2 id="security-heading">Baseline</h2>
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
                <p className="sectionLabel">PWA Ready</p>
                <h2 id="mobile-heading">Mobile First</h2>
              </div>
            </div>
            <div className="mobileStats">
              <span>
                <Clock3 aria-hidden="true" size={16} />
                Offline shell planned
              </span>
              <span>
                <Bell aria-hidden="true" size={16} />
                Push-ready design
              </span>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
