"use client";

import type { FormEvent } from "react";
import { KeyRound, Save } from "lucide-react";
import type {
  PasswordFormState,
  PasswordSaveState,
} from "@/presentation/features/settings/settings-types";

type PasswordSettingsCardProps = {
  disabled: boolean;
  form: PasswordFormState;
  loginEnabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateField: <Field extends keyof PasswordFormState>(
    field: Field,
    value: PasswordFormState[Field],
  ) => void;
  state: PasswordSaveState;
};

export function PasswordSettingsCard({
  disabled,
  form,
  loginEnabled,
  onSubmit,
  onUpdateField,
  state,
}: PasswordSettingsCardProps) {
  return (
    <article className="panel settingCard passwordSettingsCard">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">認証</p>
          <h2>パスワード変更</h2>
        </div>
        <KeyRound aria-hidden="true" className="panelIcon" size={21} />
      </div>
      <form className="passwordSettingsForm" onSubmit={onSubmit}>
        <div className="formGrid">
          <label className="fieldControl wide">
            <span>現在のパスワード</span>
            <input
              autoComplete="current-password"
              disabled={disabled}
              minLength={12}
              onChange={(event) =>
                onUpdateField("currentPassword", event.target.value)
              }
              required
              type="password"
              value={form.currentPassword}
            />
          </label>
          <label className="fieldControl wide">
            <span>新しいパスワード</span>
            <input
              autoComplete="new-password"
              disabled={disabled}
              maxLength={128}
              minLength={12}
              onChange={(event) =>
                onUpdateField("newPassword", event.target.value)
              }
              required
              type="password"
              value={form.newPassword}
            />
          </label>
          <label className="fieldControl wide">
            <span>新しいパスワード（確認）</span>
            <input
              autoComplete="new-password"
              disabled={disabled}
              maxLength={128}
              minLength={12}
              onChange={(event) =>
                onUpdateField("confirmPassword", event.target.value)
              }
              required
              type="password"
              value={form.confirmPassword}
            />
          </label>
        </div>
        {state.message && (
          <p
            className={`settingsNotice ${state.status}`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </p>
        )}
        {!loginEnabled && (
          <p className="settingsNotice error" role="status">
            通常ログイン用のパスワードが未設定です。
          </p>
        )}
        <div className="formFooter">
          <p>通常ログイン: {loginEnabled ? "有効" : "未設定"}</p>
          <button
            className="textButton primary"
            disabled={disabled}
            type="submit"
          >
            <Save aria-hidden="true" size={16} />
            {state.status === "saving" ? "変更中" : "変更"}
          </button>
        </div>
      </form>
    </article>
  );
}
