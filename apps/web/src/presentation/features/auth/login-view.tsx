"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { Building2, KeyRound, LogIn, Mail } from "lucide-react";

type LoginViewProps = {
  defaultTenantCode: string;
  nextUrl: string;
};

type LoginState = {
  status: "idle" | "submitting" | "error";
  message: string | null;
};

export function LoginView({ defaultTenantCode, nextUrl }: LoginViewProps) {
  const [tenantCode, setTenantCode] = useState(defaultTenantCode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginState, setLoginState] = useState<LoginState>({
    status: "idle",
    message: null,
  });
  const ssoLoginUrl = useMemo(
    () => `/api/auth/login?next=${encodeURIComponent(nextUrl)}`,
    [nextUrl],
  );

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
          <p className="sectionLabel">ログイン</p>
          <h1>業務ポータルへログイン</h1>
        </div>

        <form className="loginForm" onSubmit={submitLogin}>
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
            ログイン
          </button>
        </form>

        <div className="loginDivider" aria-hidden="true" />

        <a className="textButton loginSso" href={ssoLoginUrl}>
          <LogIn aria-hidden="true" size={17} />
          SSO でログイン
        </a>
      </section>
    </main>
  );
}
