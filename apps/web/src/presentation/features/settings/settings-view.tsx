"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  CircleCheckBig,
  Fingerprint,
  KeyRound,
  LogIn,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/browser";
import type {
  CurrentUserSession,
  PasskeyDeleteApiResponse,
  PasskeyListApiResponse,
  PasskeyRegistrationOptionsApiResponse,
  PasskeyRegistrationVerifyApiResponse,
  PasskeySummary,
  PasswordChangeApiResponse,
} from "@/application/security/types";
import { useWebAuthnSupport } from "@/presentation/features/auth/use-webauthn-support";
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

type PasskeySaveState = {
  status: "idle" | "loading" | "registering" | "deleting" | "success" | "error";
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
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [passkeyName, setPasskeyName] = useState("");
  const webAuthnSupported = useWebAuthnSupport();
  const [passkeyState, setPasskeyState] = useState<PasskeySaveState>({
    status: "idle",
    message: null,
  });
  const passwordLoginEnabled = Boolean(session?.user.passwordLoginEnabled);
  const passwordFormDisabled =
    !passwordLoginEnabled || passwordState.status === "saving";
  const passkeyBusy =
    passkeyState.status === "loading" ||
    passkeyState.status === "registering" ||
    passkeyState.status === "deleting";
  const passkeyRegistrationDisabled =
    !session || !webAuthnSupported || passkeyBusy;

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    async function loadPasskeys() {
      try {
        const response = await fetch("/api/auth/passkeys", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });
        const body = (await response.json()) as PasskeyListApiResponse;

        if (!response.ok || !("data" in body)) {
          throw new Error(
            "message" in body
              ? body.message
              : "Passkey情報を取得できませんでした。",
          );
        }

        if (!cancelled) {
          setPasskeys(body.data.passkeys);
          setPasskeyState({
            status: "idle",
            message: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setPasskeyState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Passkey情報を取得できませんでした。",
          });
        }
      }
    }

    void loadPasskeys();

    return () => {
      cancelled = true;
    };
  }, [session]);

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

  async function registerPasskey() {
    if (!webAuthnSupported) {
      setPasskeyState({
        status: "error",
        message: "このブラウザではPasskeyを利用できません。",
      });
      return;
    }

    setPasskeyState({
      status: "registering",
      message: null,
    });

    try {
      const optionsResponse = await fetch(
        "/api/auth/passkeys/register/options",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: passkeyName,
          }),
        },
      );
      const optionsBody =
        (await optionsResponse.json()) as PasskeyRegistrationOptionsApiResponse;

      if (!optionsResponse.ok || !("data" in optionsBody)) {
        throw new Error(
          "message" in optionsBody
            ? optionsBody.message
            : "Passkey登録を開始できませんでした。",
        );
      }

      const registrationResponse = await startRegistration({
        optionsJSON:
          optionsBody.data.options as PublicKeyCredentialCreationOptionsJSON,
      });
      const verifyResponse = await fetch(
        "/api/auth/passkeys/register/verify",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: passkeyName,
            response: registrationResponse,
          }),
        },
      );
      const verifyBody =
        (await verifyResponse.json()) as PasskeyRegistrationVerifyApiResponse;

      if (!verifyResponse.ok || !("data" in verifyBody)) {
        throw new Error(
          "message" in verifyBody
            ? verifyBody.message
            : "Passkey登録を完了できませんでした。",
        );
      }

      setPasskeyName("");
      setPasskeys((current) => [verifyBody.data.passkey, ...current]);
      setPasskeyState({
        status: "success",
        message: "Passkeyを登録しました。",
      });
    } catch (error) {
      setPasskeyState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Passkey登録を完了できませんでした。",
      });
    }
  }

  async function deletePasskey(passkey: PasskeySummary) {
    setPasskeyState({
      status: "deleting",
      message: null,
    });

    try {
      const response = await fetch(`/api/auth/passkeys/${passkey.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });
      const body = (await response.json()) as PasskeyDeleteApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "Passkeyを削除できませんでした。",
        );
      }

      setPasskeys((current) =>
        current.filter((currentPasskey) => currentPasskey.id !== passkey.id),
      );
      setPasskeyState({
        status: "success",
        message: "Passkeyを削除しました。",
      });
    } catch (error) {
      setPasskeyState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Passkeyを削除できませんでした。",
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

      <article className="panel settingCard passkeySettingsCard">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">認証</p>
            <h2>Passkey</h2>
          </div>
          <Fingerprint aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <div className="passkeyRegistrationControls">
          <label className="fieldControl">
            <span>表示名</span>
            <input
              disabled={passkeyRegistrationDisabled}
              maxLength={120}
              onChange={(event) => setPasskeyName(event.target.value)}
              placeholder="この端末"
              value={passkeyName}
            />
          </label>
          <button
            className="textButton primary"
            disabled={passkeyRegistrationDisabled}
            onClick={registerPasskey}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            {passkeyState.status === "registering" ? "登録中" : "登録"}
          </button>
        </div>
        {!webAuthnSupported && (
          <p className="settingsNotice error" role="status">
            このブラウザではPasskeyを利用できません。
          </p>
        )}
        {passkeyState.message && (
          <p
            className={`settingsNotice ${passkeyState.status}`}
            role={passkeyState.status === "error" ? "alert" : "status"}
          >
            {passkeyState.message}
          </p>
        )}
        {passkeys.length > 0 ? (
          <ul className="passkeyList">
            {passkeys.map((passkey) => (
              <li className="passkeyItem" key={passkey.id}>
                <span>
                  <strong>{passkey.name}</strong>
                  <small>
                    {formatPasskeyDate(passkey.createdAt)} /{" "}
                    {formatPasskeyDevice(passkey)}
                  </small>
                </span>
                <button
                  aria-label={`${passkey.name}を削除`}
                  className="iconButton"
                  disabled={passkeyBusy}
                  onClick={() => void deletePasskey(passkey)}
                  title="削除"
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="passkeyEmpty">
            {passkeyState.status === "loading" ? "確認中" : "未登録"}
          </p>
        )}
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

function formatPasskeyDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatPasskeyDevice(passkey: PasskeySummary) {
  const deviceType =
    passkey.deviceType === "multiDevice" ? "同期対応" : "端末固定";

  return passkey.backedUp ? `${deviceType} / バックアップ済み` : deviceType;
}
