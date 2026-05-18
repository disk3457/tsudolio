"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CircleCheckBig,
  Fingerprint,
  KeyRound,
  Link as LinkIcon,
  LogIn,
  Mail,
} from "lucide-react";
import type {
  PasskeyAuthenticationOptionsApiResponse,
  PasskeyAuthenticationVerifyApiResponse,
  PasswordResetConfirmApiResponse,
  PasswordResetRequestApiResponse,
} from "@/application/security/types";
import { useWebAuthnSupport } from "@/presentation/features/auth/use-webauthn-support";

type LoginViewProps = {
  defaultTenantCode: string;
  nextUrl: string;
  resetTenantCode: string;
  resetToken: string;
};

type AuthMode = "login" | "reset-request" | "reset-confirm";

type FormState = {
  status: "idle" | "submitting" | "success" | "error";
  message: string | null;
  resetUrl?: string | null;
};

type AuthenticationOptionsJSON = Parameters<
  typeof startAuthentication
>[0]["optionsJSON"];

const idleState: FormState = {
  status: "idle",
  message: null,
  resetUrl: null,
};

export function LoginView({
  defaultTenantCode,
  nextUrl,
  resetTenantCode,
  resetToken,
}: LoginViewProps) {
  const initialTenantCode = resetTenantCode || defaultTenantCode;
  const [mode, setMode] = useState<AuthMode>(
    resetToken ? "reset-confirm" : "login",
  );
  const [tenantCode, setTenantCode] = useState(initialTenantCode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetTokenValue, setResetTokenValue] = useState(resetToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const webAuthnSupported = useWebAuthnSupport();
  const [loginState, setLoginState] = useState<FormState>(idleState);
  const [resetState, setResetState] = useState<FormState>(idleState);
  const ssoLoginUrl = useMemo(
    () => `/api/auth/login?next=${encodeURIComponent(nextUrl)}`,
    [nextUrl],
  );
  const heading =
    mode === "reset-request"
      ? "パスワードをリセット"
      : mode === "reset-confirm"
        ? "新しいパスワードを設定"
        : "業務ポータルへログイン";

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginState({
      status: "submitting",
      message: null,
    });

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({
          email,
          password,
          tenantCode,
        }),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body.message ?? "ログインできませんでした。");
      }

      window.location.assign(nextUrl);
    } catch (error) {
      setLoginState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "ログインできませんでした。",
      });
    }
  }

  async function submitPasskeyLogin() {
    if (!webAuthnSupported) {
      setLoginState({
        status: "error",
        message: "このブラウザではPasskeyを利用できません。",
      });
      return;
    }

    setLoginState({
      status: "submitting",
      message: null,
    });

    try {
      const optionsResponse = await fetch("/api/auth/passkeys/login/options", {
        body: JSON.stringify({
          email,
          tenantCode,
        }),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const optionsBody =
        (await optionsResponse.json()) as PasskeyAuthenticationOptionsApiResponse;

      if (!optionsResponse.ok || !("data" in optionsBody)) {
        throw new Error(
          "message" in optionsBody
            ? optionsBody.message
            : "Passkeyログインを開始できませんでした。",
        );
      }

      const authenticationResponse = await startAuthentication({
        optionsJSON: optionsBody.data.options as AuthenticationOptionsJSON,
      });
      const verifyResponse = await fetch("/api/auth/passkeys/login/verify", {
        body: JSON.stringify({
          email,
          response: authenticationResponse,
          tenantCode,
        }),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const verifyBody =
        (await verifyResponse.json()) as PasskeyAuthenticationVerifyApiResponse;

      if (!verifyResponse.ok || !("data" in verifyBody)) {
        throw new Error(
          "message" in verifyBody
            ? verifyBody.message
            : "Passkeyでログインできませんでした。",
        );
      }

      window.location.assign(nextUrl);
    } catch (error) {
      setLoginState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Passkeyでログインできませんでした。",
      });
    }
  }

  async function submitResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetState({
      status: "submitting",
      message: null,
      resetUrl: null,
    });

    try {
      const response = await fetch("/api/auth/password/reset/request", {
        body: JSON.stringify({
          email: resetEmail,
          tenantCode,
        }),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as PasswordResetRequestApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body
            ? body.message
            : "パスワードリセットを申請できませんでした。",
        );
      }

      setResetState({
        status: "success",
        message: createPasswordResetRequestMessage(body.data),
        resetUrl: body.data.resetUrl ?? null,
      });
    } catch (error) {
      setResetState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "パスワードリセットを申請できませんでした。",
      });
    }
  }

  async function submitResetConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setResetState({
        status: "error",
        message: "確認用パスワードが一致しません。",
      });
      return;
    }

    setResetState({
      status: "submitting",
      message: null,
    });

    try {
      const response = await fetch("/api/auth/password/reset/confirm", {
        body: JSON.stringify({
          newPassword,
          tenantCode,
          token: resetTokenValue,
        }),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as PasswordResetConfirmApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body
            ? body.message
            : "パスワードをリセットできませんでした。",
        );
      }

      setNewPassword("");
      setConfirmPassword("");
      setResetState({
        status: "success",
        message:
          "パスワードを更新しました。新しいパスワードでログインできます。",
      });
    } catch (error) {
      setResetState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "パスワードをリセットできませんでした。",
      });
    }
  }

  function openLogin() {
    setMode("login");
    setLoginState(idleState);
    setResetState(idleState);
  }

  function openResetRequest() {
    setMode("reset-request");
    setLoginState(idleState);
    setResetState(idleState);
  }

  return (
    <main className="loginShell">
      <section className="loginPanel" aria-label="ログイン">
        <div className="loginBrand">
          <Image
            alt="Tsudolio ロゴ"
            className="loginLogo"
            height={64}
            priority
            src="/brand/tsudolio-logo-icon.png"
            width={64}
          />
          <div>
            <p className="brandName">Tsudolio</p>
            <p className="brandSub">ツドリオ</p>
          </div>
        </div>

        <div className="loginHeader">
          <p className="sectionLabel">
            {mode === "login" ? "ログイン" : "パスワード再設定"}
          </p>
          <h1>{heading}</h1>
        </div>

        {mode === "login" && (
          <>
            <form className="loginForm" onSubmit={submitLogin}>
              <TenantField tenantCode={tenantCode} setTenantCode={setTenantCode} />

              <label className="loginField">
                <span>メールアドレス</span>
                <div>
                  <Mail aria-hidden="true" size={18} />
                  <input
                    autoComplete="email"
                    inputMode="email"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </div>
              </label>

              <label className="loginField">
                <span>パスワード</span>
                <div>
                  <KeyRound aria-hidden="true" size={18} />
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </div>
              </label>

              <button
                className="textButton passkeyLoginButton"
                disabled={
                  loginState.status === "submitting" || !webAuthnSupported
                }
                onClick={() => void submitPasskeyLogin()}
                title={
                  webAuthnSupported
                    ? "Passkeyでログイン"
                    : "このブラウザではPasskeyを利用できません"
                }
                type="button"
              >
                <Fingerprint aria-hidden="true" size={17} />
                {loginState.status === "submitting"
                  ? "確認中"
                  : "Passkeyでログイン"}
              </button>

              <button
                className="loginTextAction"
                onClick={openResetRequest}
                type="button"
              >
                パスワードを忘れた場合
              </button>

              {loginState.message && (
                <p className="loginError" role="alert">
                  {loginState.message}
                </p>
              )}

              <button
                className="textButton primary loginSubmit"
                disabled={loginState.status === "submitting"}
                type="submit"
              >
                <LogIn aria-hidden="true" size={17} />
                {loginState.status === "submitting" ? "ログイン中" : "ログイン"}
              </button>
            </form>

            <div className="loginDivider" aria-hidden="true" />

            <a className="textButton loginSso" href={ssoLoginUrl}>
              <LogIn aria-hidden="true" size={17} />
              SSO でログイン
            </a>
          </>
        )}

        {mode === "reset-request" && (
          <>
            <form className="loginForm" onSubmit={submitResetRequest}>
              <TenantField tenantCode={tenantCode} setTenantCode={setTenantCode} />

              <label className="loginField">
                <span>メールアドレス</span>
                <div>
                  <Mail aria-hidden="true" size={18} />
                  <input
                    autoComplete="email"
                    inputMode="email"
                    onChange={(event) => setResetEmail(event.target.value)}
                    required
                    type="email"
                    value={resetEmail}
                  />
                </div>
              </label>

              <ResetMessage state={resetState} />

              {resetState.resetUrl && (
                <a className="textButton loginSso" href={resetState.resetUrl}>
                  <LinkIcon aria-hidden="true" size={17} />
                  開発用リセットリンク
                </a>
              )}

              <button
                className="textButton primary loginSubmit"
                disabled={resetState.status === "submitting"}
                type="submit"
              >
                <Mail aria-hidden="true" size={17} />
                送信
              </button>
            </form>

            <BackToLoginButton onClick={openLogin} />
          </>
        )}

        {mode === "reset-confirm" && (
          <>
            <form className="loginForm" onSubmit={submitResetConfirm}>
              <TenantField tenantCode={tenantCode} setTenantCode={setTenantCode} />

              <label className="loginField">
                <span>リセットトークン</span>
                <div>
                  <KeyRound aria-hidden="true" size={18} />
                  <input
                    autoComplete="one-time-code"
                    onChange={(event) => setResetTokenValue(event.target.value)}
                    required
                    value={resetTokenValue}
                  />
                </div>
              </label>

              <label className="loginField">
                <span>新しいパスワード</span>
                <div>
                  <KeyRound aria-hidden="true" size={18} />
                  <input
                    autoComplete="new-password"
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    type="password"
                    value={newPassword}
                  />
                </div>
              </label>

              <label className="loginField">
                <span>新しいパスワード確認</span>
                <div>
                  <KeyRound aria-hidden="true" size={18} />
                  <input
                    autoComplete="new-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </div>
              </label>

              <ResetMessage state={resetState} />

              <button
                className="textButton primary loginSubmit"
                disabled={resetState.status === "submitting"}
                type="submit"
              >
                <CircleCheckBig aria-hidden="true" size={17} />
                更新
              </button>
            </form>

            <BackToLoginButton onClick={openLogin} />
          </>
        )}
      </section>
    </main>
  );
}

function TenantField({
  setTenantCode,
  tenantCode,
}: {
  setTenantCode: (value: string) => void;
  tenantCode: string;
}) {
  return (
    <label className="loginField">
      <span>テナントコード</span>
      <div>
        <Building2 aria-hidden="true" size={18} />
        <input
          autoComplete="organization"
          onChange={(event) => setTenantCode(event.target.value)}
          required
          value={tenantCode}
        />
      </div>
    </label>
  );
}

function ResetMessage({ state }: { state: FormState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={`loginNotice ${state.status}`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

function createPasswordResetRequestMessage(
  data: Extract<PasswordResetRequestApiResponse, { data: unknown }>["data"],
) {
  if (data.resetUrl && data.emailDelivery !== "sent") {
    return "開発環境ではメール送信を完了できなかったため、開発用リセットリンクを表示しています。";
  }

  return "入力したメールアドレスにリセット手順を送信しました。";
}

function BackToLoginButton({ onClick }: { onClick: () => void }) {
  return (
    <>
      <div className="loginDivider" aria-hidden="true" />
      <button className="textButton loginSso" onClick={onClick} type="button">
        <ArrowLeft aria-hidden="true" size={17} />
        ログインに戻る
      </button>
    </>
  );
}
