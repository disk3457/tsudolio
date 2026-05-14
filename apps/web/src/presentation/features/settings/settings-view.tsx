import { CircleCheckBig, LogIn, Send } from "lucide-react";
import { settingGroups } from "@/presentation/features/settings/settings-demo-data";

export function SettingsView() {
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
          <p className="sectionLabel">認証</p>
          <h2>ログイン方式</h2>
          <p>通常ログインと OIDC SSO を同じセッション基盤で利用できます。</p>
        </div>
        <div className="actionRow">
          <a className="textButton" href="/login">
            <LogIn aria-hidden="true" size={17} />
            通常ログイン
          </a>
          <a className="textButton" href="/api/auth/login">
            <LogIn aria-hidden="true" size={17} />
            SSO
          </a>
          <button className="textButton primary" type="button">
            <Send aria-hidden="true" size={17} />
            テスト通知
          </button>
        </div>
      </article>
    </section>
  );
}
