import { CircleCheckBig, History, ShieldCheck } from "lucide-react";
import { AuditEventList } from "@/presentation/components/audit-event-list";
import type { DashboardLoadState } from "@/application/dashboard/types";
import { securityItems } from "@/presentation/features/security/security-demo-data";

export function SecurityView({
  dashboardState,
}: {
  dashboardState: DashboardLoadState;
}) {
  const timezone = dashboardState.snapshot?.tenant.timezone ?? "Asia/Tokyo";
  const securityRows = dashboardState.snapshot?.securityEvents ?? [];

  return (
    <section className="viewGrid">
      <section className="panel widePanel" aria-labelledby="audit-heading">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">監査</p>
            <h2 id="audit-heading">直近の監査イベント</h2>
          </div>
          <History aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <AuditEventList
          emptyDescription="DB接続後、管理操作や認証・権限変更の履歴がここに表示されます。"
          rows={securityRows}
          status={dashboardState.status}
          timezone={timezone}
        />
      </section>

      <section className="panel" aria-labelledby="control-heading">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">統制</p>
            <h2 id="control-heading">基本対策</h2>
          </div>
          <ShieldCheck aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <ul className="securityList">
          {securityItems.map((item) => (
            <li key={item}>
              <CircleCheckBig aria-hidden="true" size={17} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
