"use client";

import { useState, type FormEvent } from "react";
import { CircleCheckBig, KeyRound, LogIn, Save, Send } from "lucide-react";
import type {
  CurrentUserSession,
  PasswordChangeApiResponse,
} from "@/application/security/types";
import { settingGroups } from "@/presentation/features/settings/settings-static-data";

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PasswordSaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string | null;
};

const defaultPasswordForm: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function SettingsView({
  session,
}: {
  session: CurrentUserSession | null;
}) {
  const [passwordForm, setPasswordForm] =
    useState<PasswordFormState>(defaultPasswordForm);
  const [passwordState, setPasswordState] = useState<PasswordSaveState>({
    status: "idle",
    message: null,
  });
  const passwordLoginEnabled = Boolean(session?.user.passwordLoginEnabled);
  const passwordFormDisabled =
    !passwordLoginEnabled || passwordState.status === "saving";

  function updatePasswordField<Field extends keyof PasswordFormState>(
    field: Field,
    value: PasswordFormState[Field],
  ) {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordState({
        status: "error",
        message: "新しいパスワードと確認入力が一致しません。",
      });
      return;
    }

    setPasswordState({
      status: "saving",
      message: null,
    });

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const body = (await response.json()) as PasswordChangeApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "パスワードを変更できませんでした",
        );
      }

      setPasswordForm(defaultPasswordForm);
      setPasswordState({
        status: "success",
        message: "パスワードを変更しました。",
      });
    } catch (error) {
      setPasswordState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "パスワードを変更できませんでした",
      });
    }
  }

  return (
    <section className="settingsGrid" aria-label="共通設定">
      <article className="panel settingCard passwordSettingsCard">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">認証</p>
            <h2>パスワード変更</h2>
          </div>
          <KeyRound aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <form className="passwordSettingsForm" onSubmit={submitPasswordChange}>
          <div className="formGrid">
            <label className="fieldControl wide">
              <span>現在のパスワード</span>
              <input
                autoComplete="current-password"
                disabled={passwordFormDisabled}
                minLength={12}
                onChange={(event) =>
                  updatePasswordField("currentPassword", event.target.value)
                }
                required
                type="password"
                value={passwordForm.currentPassword}
              />
            </label>
            <label className="fieldControl wide">
              <span>新しいパスワード</span>
              <input
                autoComplete="new-password"
                disabled={passwordFormDisabled}
                maxLength={128}
                minLength={12}
                onChange={(event) =>
                  updatePasswordField("newPassword", event.target.value)
                }
                required
                type="password"
                value={passwordForm.newPassword}
              />
            </label>
            <label className="fieldControl wide">
              <span>新しいパスワード（確認）</span>
              <input
                autoComplete="new-password"
                disabled={passwordFormDisabled}
                maxLength={128}
                minLength={12}
                onChange={(event) =>
                  updatePasswordField("confirmPassword", event.target.value)
                }
                required
                type="password"
                value={passwordForm.confirmPassword}
              />
            </label>
          </div>
          {passwordState.message && (
            <p
              className={`settingsNotice ${passwordState.status}`}
              role={passwordState.status === "error" ? "alert" : "status"}
            >
              {passwordState.message}
            </p>
          )}
          {!passwordLoginEnabled && (
            <p className="settingsNotice error" role="status">
              通常ログイン用のパスワードが未設定です。
            </p>
          )}
          <div className="formFooter">
            <p>通常ログイン: {passwordLoginEnabled ? "有効" : "未設定"}</p>
            <button
              className="textButton primary"
              disabled={passwordFormDisabled}
              type="submit"
            >
              <Save aria-hidden="true" size={16} />
              {passwordState.status === "saving" ? "変更中" : "変更"}
            </button>
          </div>
        </form>
      </article>

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
