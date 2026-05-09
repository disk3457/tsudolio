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
    title: "予定・施設予約",
    label: "スケジュール",
    summary: "本日の予定 18 件、会議室予約 7 件",
    status: "稼働中",
    icon: CalendarDays,
    tone: "blue",
  },
  {
    title: "掲示・回覧",
    label: "お知らせ",
    summary: "未読 4 件、要確認 2 件",
    status: "確認あり",
    icon: MessageSquareText,
    tone: "cyan",
  },
  {
    title: "申請・承認",
    label: "ワークフロー",
    summary: "承認待ち 11 件、差戻し 1 件",
    status: "対応必要",
    icon: ClipboardList,
    tone: "rose",
  },
  {
    title: "文書管理",
    label: "ファイル共有",
    summary: "共有文書 234 件、保管期限確認 6 件",
    status: "管理中",
    icon: FileText,
    tone: "sky",
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

export default function Home() {
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
          {[
            ["ダッシュボード", CheckCircle2],
            ["予定", CalendarDays],
            ["組織", UsersRound],
            ["文書", FileText],
            ["セキュリティ", ShieldCheck],
            ["設定", Settings],
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
            <p className="eyebrow">デモ市総合病院 / 業務ポータル</p>
            <h1>業務ダッシュボード</h1>
          </div>
          <div className="topbarActions">
            <label className="searchBox">
              <Search aria-hidden="true" size={18} />
              <span className="srOnly">検索</span>
              <input placeholder="予定・文書・申請を検索" />
            </label>
            <button className="iconButton" aria-label="通知">
              <Bell aria-hidden="true" size={19} />
            </button>
          </div>
        </header>

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
                <p className="sectionLabel">本日</p>
                <h2 id="schedule-heading">予定</h2>
              </div>
              <button className="textButton">
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
              <button className="iconButton" aria-label="承認設定">
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
      </section>
    </main>
  );
}
