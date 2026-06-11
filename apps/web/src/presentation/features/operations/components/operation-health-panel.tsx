import { CheckCircle2, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import type {
  OperationHealthCheck,
  OperationHealthStatus,
} from "@/application/operations/types";
import { EmptyState } from "@/presentation/components/empty-state";
import { getHealthLabel } from "@/presentation/features/operations/view-helpers";
import { formatFullDateTime } from "@/shared/formatters";

export function OperationHealthPanel({
  checks,
  isLoading,
  timezone,
}: {
  checks: OperationHealthCheck[];
  isLoading: boolean;
  timezone: string;
}) {
  return (
    <section className="panel operationsHealthPanel">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">Health</p>
          <h2>ヘルスチェック</h2>
        </div>
        <ShieldCheck aria-hidden="true" className="panelIcon" size={21} />
      </div>

      <div className="operationHealthList">
        {checks.map((check) => (
          <OperationHealthItem
            check={check}
            key={check.key}
            timezone={timezone}
          />
        ))}
        {isLoading && (
          <EmptyState
            description="各種チェックを集計しています。"
            title="確認中"
          />
        )}
      </div>
    </section>
  );
}

function OperationHealthItem({
  check,
  timezone,
}: {
  check: OperationHealthCheck;
  timezone: string;
}) {
  return (
    <article className={`operationHealthItem ${check.status.toLowerCase()}`}>
      <OperationHealthIcon status={check.status} />
      <div>
        <div className="operationHealthHeading">
          <strong>{check.label}</strong>
          <span>{getHealthLabel(check.status)}</span>
        </div>
        <p>{check.detail}</p>
        <small>
          {check.value} / {formatFullDateTime(check.checkedAt, timezone)}
        </small>
      </div>
    </article>
  );
}

function OperationHealthIcon({ status }: { status: OperationHealthStatus }) {
  if (status === "OK") {
    return <CheckCircle2 aria-hidden="true" size={19} />;
  }

  if (status === "CRITICAL") {
    return <XCircle aria-hidden="true" size={19} />;
  }

  return <TriangleAlert aria-hidden="true" size={19} />;
}
