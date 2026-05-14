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
          <p className="sectionLabel">次の接続</p>
          <h2>認証と通知の外部連携</h2>
          <p>OIDC ログインの開始点を確認し、メールとプッシュ通知を後続ステップで接続します。</p>
        </div>
        <div className="actionRow">
          <a className="textButton" href="/api/auth/login">
            <LogIn aria-hidden="true" size={17} />
            SSO ログイン
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
