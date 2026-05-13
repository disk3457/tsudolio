import { AlertCircle, Database } from "lucide-react";
import type { DashboardLoadState } from "@/application/dashboard/types";
import { formatDateTime } from "@/shared/formatters";

export function DataStatusNotice({
  dashboardState,
}: {
  dashboardState: DashboardLoadState;
}) {
  if (dashboardState.status === "ready") {
    return (
      <section className="dataNotice ready" aria-label="データ接続状態">
        <Database aria-hidden="true" size={19} />
        <div>
          <p className="sectionLabel">データベース連携</p>
          <h2>実データでダッシュボードを表示しています</h2>
          <p>
            {dashboardState.updatedAt === null
              ? "最新データを取得済みです。"
              : `${formatDateTime(dashboardState.updatedAt, dashboardState.snapshot?.tenant.timezone ?? "Asia/Tokyo")} 時点で更新`}
          </p>
        </div>
      </section>
    );
  }

  if (dashboardState.status === "loading") {
    return (
      <section className="dataNotice loading" aria-label="データ接続状態">
        <Database aria-hidden="true" size={19} />
        <div>
          <p className="sectionLabel">データベース連携</p>
          <h2>最新データを取得しています</h2>
          <p>予定、承認、通知、監査ログをAPIから読み込んでいます。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="dataNotice error" aria-label="データ接続状態">
      <AlertCircle aria-hidden="true" size={19} />
      <div>
        <p className="sectionLabel">データベース連携</p>
        <h2>DBデータを取得できませんでした</h2>
        <p>{dashboardState.message}</p>
      </div>
    </section>
  );
}
