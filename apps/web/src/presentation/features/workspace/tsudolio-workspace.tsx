"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Bell, LogOut, Search } from "lucide-react";
import type {
  DashboardApiResponse,
  DashboardLoadState,
} from "@/application/dashboard/types";
import type {
  CurrentUserApiResponse,
  SessionLoadState,
} from "@/application/security/types";
import { navItems } from "@/presentation/features/workspace/data/navigation";
import type { ViewKey } from "@/presentation/features/workspace/types";
import { DashboardView } from "@/presentation/features/dashboard/dashboard-view";
import { DocumentsView } from "@/presentation/features/documents/documents-view";
import { NoticesView } from "@/presentation/features/notices/notices-view";
import { OperationsView } from "@/presentation/features/operations/operations-view";
import { OrganizationView } from "@/presentation/features/organization/organization-view";
import { ScheduleView } from "@/presentation/features/schedule/schedule-view";
import { SecurityView } from "@/presentation/features/security/security-view";
import { SettingsView } from "@/presentation/features/settings/settings-view";
import { WorkflowView } from "@/presentation/features/workflows/workflow-view";

export function TsudolioWorkspace() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [dashboardState, setDashboardState] = useState<DashboardLoadState>({
    snapshot: null,
    source: "fallback",
    status: "loading",
    message: null,
    updatedAt: null,
  });
  const [sessionState, setSessionState] = useState<SessionLoadState>({
    session: null,
    status: "loading",
    message: null,
  });
  const activeItem = navItems.find((item) => item.key === activeView) ?? navItems[0];
  const tenantName = dashboardState.snapshot?.tenant.name ?? "組織";
  const currentUserLabel =
    sessionState.session?.user.displayName ?? "利用者確認中";
  const currentUserRoleLabel = sessionState.session?.user.isSystemAdmin
    ? "システム管理者"
    : `${sessionState.session?.permissions.length ?? 0} 権限`;

  async function logout() {
    await fetch("/api/auth/logout", {
      cache: "no-store",
      method: "POST",
    });
    window.location.assign("/login");
  }

  useEffect(() => {
    let shouldIgnore = false;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });
        const body = (await response.json()) as DashboardApiResponse;

        if (!response.ok || !("data" in body)) {
          throw new Error(
            "message" in body ? body.message : "ダッシュボードデータを取得できませんでした",
          );
        }

        if (!shouldIgnore) {
          setDashboardState({
            snapshot: body.data,
            source: body.source,
            status: "ready",
            message: null,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        if (!shouldIgnore) {
          setDashboardState({
            snapshot: null,
            source: "fallback",
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "ダッシュボードデータを取得できませんでした",
            updatedAt: null,
          });
        }
      }
    }

    void loadDashboard();

    return () => {
      shouldIgnore = true;
    };
  }, []);

  useEffect(() => {
    let shouldIgnore = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });
        const body = (await response.json()) as CurrentUserApiResponse;

        if (!response.ok || !("data" in body)) {
          if (response.status === 401) {
            window.location.replace(
              `/login?next=${encodeURIComponent(
                `${window.location.pathname}${window.location.search}`,
              )}`,
            );
            return;
          }

          throw new Error(
            "message" in body ? body.message : "利用者情報を取得できませんでした",
          );
        }

        if (!shouldIgnore) {
          setSessionState({
            session: body.data,
            status: "ready",
            message: null,
          });
        }
      } catch (error) {
        if (!shouldIgnore) {
          setSessionState({
            session: null,
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "利用者情報を取得できませんでした",
          });
        }
      }
    }

    void loadSession();

    return () => {
      shouldIgnore = true;
    };
  }, []);

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
            <p className="eyebrow">{tenantName} / 業務ポータル</p>
            <h1>{activeItem.title}</h1>
            <p className="topbarLead">{activeItem.description}</p>
          </div>
          <div className="topbarActions">
            <div
              aria-label={sessionState.message ?? "現在の利用者"}
              className={`sessionBadge ${sessionState.status}`}
            >
              <strong>{currentUserLabel}</strong>
              <span>{currentUserRoleLabel}</span>
            </div>
            <label className="searchBox">
              <Search aria-hidden="true" size={18} />
              <span className="srOnly">検索</span>
              <input placeholder="予定・掲示・申請・文書を検索" />
            </label>
            <button className="iconButton" aria-label="通知" type="button">
              <Bell aria-hidden="true" size={19} />
            </button>
            <button
              className="iconButton"
              aria-label="ログアウト"
              onClick={logout}
              type="button"
            >
              <LogOut aria-hidden="true" size={19} />
            </button>
          </div>
        </header>

        {activeView === "dashboard" && (
          <DashboardView dashboardState={dashboardState} setActiveView={setActiveView} />
        )}
        {activeView === "schedule" && <ScheduleView />}
        {activeView === "notices" && <NoticesView />}
        {activeView === "workflow" && <WorkflowView />}
        {activeView === "organization" && <OrganizationView />}
        {activeView === "documents" && <DocumentsView />}
        {activeView === "operations" && <OperationsView />}
        {activeView === "security" && (
          <SecurityView dashboardState={dashboardState} />
        )}
        {activeView === "settings" && (
          <SettingsView session={sessionState.session} />
        )}
      </section>
    </main>
  );
}
