import type { ChangeEvent } from "react";
import { AlertCircle, Database, FileCheck2, FileDown, Upload } from "lucide-react";
import type {
  OperationImportIssue,
  OperationRestorePlanStep,
  OperationsImportValidationReport,
  OperationsSnapshot,
} from "@/application/operations/types";
import { EmptyState } from "@/presentation/components/empty-state";
import type { useOperationsConsole } from "@/presentation/features/operations/use-operations-console";
import {
  getImportIssueMeta,
  getImportStatusMeta,
  getImportTableStatusLabel,
  getRestorePlanActionLabel,
  getRestorePlanPhaseLabel,
  getRestorePlanStepStatusMeta,
} from "@/presentation/features/operations/view-helpers";
import { formatFullDateTime, formatNumber } from "@/shared/formatters";

type ImportValidationState = ReturnType<
  typeof useOperationsConsole
>["importValidationState"];

export function OperationBackupPanel({
  importValidationState,
  onValidateImportFile,
  snapshot,
  timezone,
}: {
  importValidationState: ImportValidationState;
  onValidateImportFile: (file: File) => Promise<void>;
  snapshot: OperationsSnapshot | null;
  timezone: string;
}) {
  async function selectImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      await onValidateImportFile(file);
      event.currentTarget.value = "";
    }
  }

  return (
    <section className="panel operationsBackupPanel">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">Export</p>
          <h2>運用エクスポート</h2>
        </div>
        <Database aria-hidden="true" className="panelIcon" size={21} />
      </div>

      {snapshot ? (
        <div className="operationBackupBody">
          <div className="operationBackupMetric">
            <span>対象レコード</span>
            <strong>
              {formatNumber(snapshot.backup.estimatedRecordCount)}
              <small>件</small>
            </strong>
          </div>
          <code>{snapshot.backup.filename}</code>
          <div className="operationBackupIncludes">
            {snapshot.backup.includes.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <a
            aria-label="運用データをJSONでダウンロード"
            className="textButton primary"
            href={snapshot.backup.endpoint}
          >
            <FileDown aria-hidden="true" size={17} />
            <span>ダウンロード</span>
          </a>

          <div className="operationImportBox">
            <div className="operationImportHeader">
              <div>
                <p className="sectionLabel">Restore</p>
                <h3>復元前チェック</h3>
              </div>
              <label
                className={`textButton operationImportUpload ${
                  importValidationState.status === "validating"
                    ? "disabled"
                    : ""
                }`}
              >
                <Upload aria-hidden="true" size={17} />
                <span>
                  {importValidationState.status === "validating"
                    ? "検査中"
                    : "JSONを選択"}
                </span>
                <input
                  accept="application/json,.json"
                  className="srOnly"
                  disabled={importValidationState.status === "validating"}
                  onChange={selectImportFile}
                  type="file"
                />
              </label>
            </div>

            {importValidationState.status === "error" &&
              importValidationState.message && (
                <div className="operationImportAlert" role="alert">
                  <AlertCircle aria-hidden="true" size={17} />
                  <p>{importValidationState.message}</p>
                </div>
              )}

            {importValidationState.report && (
              <OperationImportReport
                fileName={importValidationState.fileName}
                report={importValidationState.report}
                timezone={timezone}
              />
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          description="エクスポート情報を取得できませんでした。"
          title="準備中"
        />
      )}
    </section>
  );
}

function OperationImportReport({
  fileName,
  report,
  timezone,
}: {
  fileName: string | null;
  report: OperationsImportValidationReport;
  timezone: string;
}) {
  const status = getImportStatusMeta(report.status);

  return (
    <div className={`operationImportReport ${status.level}`}>
      <div className="operationImportStatus">
        <FileCheck2 aria-hidden="true" size={20} />
        <div>
          <span>{fileName ?? "選択ファイル"}</span>
          <strong>{status.label}</strong>
          <p>
            {report.tenant.code ?? "tenant未設定"} /{" "}
            {formatFullDateTime(report.generatedAt, timezone)}
          </p>
        </div>
      </div>

      <div className="operationImportTotals" aria-label="インポート件数">
        <div>
          <span>読込対象</span>
          <strong>{formatNumber(report.totalIncomingRecords)}</strong>
        </div>
        <div>
          <span>現在件数</span>
          <strong>{formatNumber(report.totalCurrentRecords)}</strong>
        </div>
      </div>

      <OperationRestorePlanView
        report={report}
        steps={report.restorePlan.steps}
      />

      {report.issues.length > 0 && (
        <div className="operationImportIssues">
          {report.issues.map((issue) => (
            <OperationImportIssueItem issue={issue} key={issue.key} />
          ))}
        </div>
      )}

      <div className="operationImportTables">
        {report.tables.map((table) => (
          <div className="operationImportTableRow" key={table.key}>
            <span>{table.label}</span>
            <strong>{getImportTableStatusLabel(table.status)}</strong>
            <small>
              {formatNumber(table.incomingCount)} /{" "}
              {formatNumber(table.currentCount)}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationRestorePlanView({
  report,
  steps,
}: {
  report: OperationsImportValidationReport;
  steps: OperationRestorePlanStep[];
}) {
  const status = getImportStatusMeta(report.restorePlan.status);

  return (
    <div className={`operationRestorePlan ${status.level}`}>
      <div className="operationRestorePlanHeader">
        <div>
          <span>復元計画</span>
          <strong>{report.restorePlan.summary}</strong>
          {report.restorePlan.blockedReason && (
            <p>{report.restorePlan.blockedReason}</p>
          )}
        </div>
        <span>{report.restorePlan.canRestore ? "実行可能" : "停止"}</span>
      </div>

      <div className="operationRestorePlanFacts">
        <div>
          <span>予定件数</span>
          <strong>{formatNumber(report.restorePlan.estimatedRecordCount)}</strong>
        </div>
        <div>
          <span>置換</span>
          <strong>{report.restorePlan.destructive ? "あり" : "なし"}</strong>
        </div>
      </div>

      <div className="operationRestoreSteps">
        {steps.map((step) => (
          <OperationRestorePlanStepItem key={step.key} step={step} />
        ))}
      </div>
    </div>
  );
}

function OperationRestorePlanStepItem({
  step,
}: {
  step: OperationRestorePlanStep;
}) {
  const status = getRestorePlanStepStatusMeta(step.status);

  return (
    <article className={`operationRestoreStep ${status.level}`}>
      <div className="operationRestoreStepHeading">
        <span>{getRestorePlanPhaseLabel(step.phase)}</span>
        <strong>{step.label}</strong>
      </div>
      <p>{step.detail}</p>
      <div className="operationRestoreStepMeta">
        <span>{getRestorePlanActionLabel(step.action)}</span>
        <span>{status.label}</span>
        <span>{formatNumber(step.recordCount)}件</span>
      </div>
    </article>
  );
}

function OperationImportIssueItem({
  issue,
}: {
  issue: OperationImportIssue;
}) {
  const severity = getImportIssueMeta(issue.severity);

  return (
    <article className={`operationImportIssue ${severity.level}`}>
      <span>{severity.label}</span>
      <div>
        <strong>{issue.label}</strong>
        <p>{issue.detail}</p>
      </div>
    </article>
  );
}
