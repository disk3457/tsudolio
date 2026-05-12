"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Bell, Search } from "lucide-react";
import type {
  DashboardApiResponse,
  DashboardLoadState,
} from "@/features/dashboard/types";
import { navItems } from "@/features/workspace/data/navigation";
import type { ViewKey } from "@/features/workspace/types";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { DocumentsView } from "@/features/documents/documents-view";
import { OrganizationView } from "@/features/organization/organization-view";
import { ScheduleView } from "@/features/schedule/schedule-view";
import { SecurityView } from "@/features/security/security-view";
import { SettingsView } from "@/features/settings/settings-view";

export function TsudolioWorkspace() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [dashboardState, setDashboardState] = useState<DashboardLoadState>({
    snapshot: null,
    source: "fallback",
    status: "loading",
    message: null,
    updatedAt: null,
  });
  const activeItem = navItems.find((item) => item.key === activeView) ?? navItems[0];
  const tenantName = dashboardState.snapshot?.tenant.name ?? "デモ市総合病院";

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
            <label className="searchBox">
              <Search aria-hidden="true" size={18} />
              <span className="srOnly">検索</span>
              <input placeholder="予定・文書・申請を検索" />
            </label>
            <button className="iconButton" aria-label="通知" type="button">
              <Bell aria-hidden="true" size={19} />
            </button>
          </div>
        </header>

        {activeView === "dashboard" && (
          <DashboardView dashboardState={dashboardState} setActiveView={setActiveView} />
        )}
        {activeView === "schedule" && <ScheduleView />}
        {activeView === "organization" && <OrganizationView />}
        {activeView === "documents" && <DocumentsView />}
        {activeView === "security" && (
          <SecurityView dashboardState={dashboardState} />
        )}
        {activeView === "settings" && <SettingsView />}
      </section>
    </main>
  );
}
