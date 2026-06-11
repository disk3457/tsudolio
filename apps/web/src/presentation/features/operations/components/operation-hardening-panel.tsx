import { CheckCircle2, ListChecks, TriangleAlert, XCircle } from "lucide-react";
import type {
  OperationHardeningChecklist,
  OperationHardeningItem,
  OperationHardeningStatus,
} from "@/application/operations/types";
import { EmptyState } from "@/presentation/components/empty-state";
import { getHardeningStatusMeta } from "@/presentation/features/operations/view-helpers";
import { formatFullDateTime, formatNumber } from "@/shared/formatters";

export function OperationHardeningPanel({
  checklist,
  isLoading,
  timezone,
}: {
  checklist: OperationHardeningChecklist | null;
  isLoading: boolean;
  timezone: string;
}) {
  const status = getHardeningStatusMeta(checklist?.status ?? "ATTENTION");

  return (
    <section className="panel operationsHardeningPanel">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">Hardening</p>
          <h2>セキュリティ強化チェックリスト</h2>
        </div>
        <ListChecks aria-hidden="true" className="panelIcon" size={21} />
      </div>

      {checklist ? (
        <>
          <div className={`operationHardeningSummary ${status.level}`}>
            <div className="operationHardeningScore">
              <span>{status.label}</span>
              <strong>
                {checklist.score}
                <small>%</small>
              </strong>
              <p>{formatFullDateTime(checklist.generatedAt, timezone)}</p>
            </div>
            <div className="operationHardeningCounts">
              <div>
                <span>完了</span>
                <strong>{formatNumber(checklist.completedCount)}</strong>
              </div>
              <div>
                <span>確認</span>
                <strong>{formatNumber(checklist.attentionCount)}</strong>
              </div>
              <div>
                <span>要対応</span>
                <strong>{formatNumber(checklist.actionRequiredCount)}</strong>
              </div>
            </div>
          </div>

          <div className="operationHardeningList">
            {checklist.items.map((item) => (
              <OperationHardeningChecklistItem item={item} key={item.key} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          description="強化項目を集計しています。"
          title={isLoading ? "確認中" : "表示できるチェック項目がありません"}
        />
      )}
    </section>
  );
}

function OperationHardeningChecklistItem({
  item,
}: {
  item: OperationHardeningItem;
}) {
  const status = getHardeningStatusMeta(item.status);

  return (
    <article className={`operationHardeningItem ${status.level}`}>
      <OperationHardeningIcon status={item.status} />
      <div>
        <div className="operationHardeningHeading">
          <strong>{item.label}</strong>
          <span>{status.label}</span>
        </div>
        <p>{item.detail}</p>
        <small>{item.evidence}</small>
      </div>
    </article>
  );
}

function OperationHardeningIcon({
  status,
}: {
  status: OperationHardeningStatus;
}) {
  if (status === "OK") {
    return <CheckCircle2 aria-hidden="true" size={19} />;
  }

  if (status === "ACTION_REQUIRED") {
    return <XCircle aria-hidden="true" size={19} />;
  }

  return <TriangleAlert aria-hidden="true" size={19} />;
}
