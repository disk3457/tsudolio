import {
  Activity,
  Building2,
  Clock3,
  Database,
  ServerCog,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { OperationMetric } from "@/application/operations/types";
import { formatNumber } from "@/shared/formatters";

export function OperationMetricCard({ metric }: { metric: OperationMetric }) {
  return (
    <article className={`operationMetric ${metric.tone}`}>
      <div>
        <span>{metric.label}</span>
        <strong>
          {formatNumber(metric.value)}
          <small>{metric.unit}</small>
        </strong>
        <p>{metric.detail}</p>
      </div>
      <OperationMetricIcon metricKey={metric.key} />
    </article>
  );
}

function OperationMetricIcon({ metricKey }: { metricKey: string }) {
  if (metricKey === "audit") {
    return <ShieldCheck aria-hidden="true" size={24} />;
  }

  if (metricKey === "content") {
    return <Database aria-hidden="true" size={24} />;
  }

  if (metricKey === "facilities") {
    return <Building2 aria-hidden="true" size={24} />;
  }

  if (metricKey === "identity") {
    return <UsersRound aria-hidden="true" size={24} />;
  }

  if (metricKey === "permissions") {
    return <ServerCog aria-hidden="true" size={24} />;
  }

  if (metricKey === "schedule") {
    return <Clock3 aria-hidden="true" size={24} />;
  }

  if (metricKey === "workflow") {
    return <Activity aria-hidden="true" size={24} />;
  }

  return <ServerCog aria-hidden="true" size={24} />;
}
