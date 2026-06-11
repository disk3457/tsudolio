import type { ChangeEvent } from "react";
import {
  AlertCircle,
  Database,
  FileCheck2,
  FileDown,
  PlayCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type {
  OperationImportIssue,
  OperationRestorePlanStep,
  OperationsImportValidationReport,
  OperationsRestoreDryRunReport,
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
type RestoreDryRunState = ReturnType<
  typeof useOperationsConsole
>["restoreDryRunState"];

export function OperationBackupPanel({
  importValidationState,
  onRunRestoreDryRun,
  onSelectCurrentBackupFile,
  onUpdateRestoreConfirmationToken,
  onValidateImportFile,
  restoreDryRunState,
  snapshot,
  timezone,
}: {
  importValidationState: ImportValidationState;
  onRunRestoreDryRun: () => Promise<void>;
  onSelectCurrentBackupFile: (file: File) => Promise<void>;
  onUpdateRestoreConfirmationToken: (value: string) => void;
  onValidateImportFile: (file: File) => Promise<void>;
  restoreDryRunState: RestoreDryRunState;
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

  async function selectCurrentBackupFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (file) {
      await onSelectCurrentBackupFile(file);
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
                onRunRestoreDryRun={onRunRestoreDryRun}
                onSelectCurrentBackupFile={selectCurrentBackupFile}
                onUpdateRestoreConfirmationToken={
                  onUpdateRestoreConfirmationToken
                }
                report={importValidationState.report}
                restoreDryRunState={restoreDryRunState}
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
  onRunRestoreDryRun,
  onSelectCurrentBackupFile,
  onUpdateRestoreConfirmationToken,
  report,
  restoreDryRunState,
  timezone,
}: {
  fileName: string | null;
  onRunRestoreDryRun: () => Promise<void>;
  onSelectCurrentBackupFile: (
    event: ChangeEvent<HTMLInputElement>,
  ) => Promise<void>;
  onUpdateRestoreConfirmationToken: (value: string) => void;
  report: OperationsImportValidationReport;
  restoreDryRunState: RestoreDryRunState;
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

      <OperationRestoreDryRunPanel
        onRunRestoreDryRun={onRunRestoreDryRun}
        onSelectCurrentBackupFile={onSelectCurrentBackupFile}
        onUpdateRestoreConfirmationToken={onUpdateRestoreConfirmationToken}
        report={report}
        restoreDryRunState={restoreDryRunState}
        timezone={timezone}
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

function OperationRestoreDryRunPanel({
  onRunRestoreDryRun,
  onSelectCurrentBackupFile,
  onUpdateRestoreConfirmationToken,
  report,
  restoreDryRunState,
  timezone,
}: {
  onRunRestoreDryRun: () => Promise<void>;
  onSelectCurrentBackupFile: (
    event: ChangeEvent<HTMLInputElement>,
  ) => Promise<void>;
  onUpdateRestoreConfirmationToken: (value: string) => void;
  report: OperationsImportValidationReport;
  restoreDryRunState: RestoreDryRunState;
  timezone: string;
}) {
  const expectedToken = createRestoreConfirmationToken(report);
  const isRunning = restoreDryRunState.status === "running";
  const canRun =
    Boolean(expectedToken) &&
    Boolean(restoreDryRunState.currentBackupPayload) &&
    Boolean(restoreDryRunState.confirmationToken.trim()) &&
    !isRunning;
  const messageClass = getRestoreDryRunMessageClass(restoreDryRunState);

  return (
    <div className="operationRestoreDryRun">
      <div className="operationRestoreDryRunHeader">
        <ShieldCheck aria-hidden="true" size={20} />
        <div>
          <span>Dry-run</span>
          <strong>復元実行前の安全確認</strong>
          <p>
            確認トークン <code>{expectedToken || "生成不可"}</code>
          </p>
        </div>
      </div>

      <div className="operationRestoreDryRunControls">
        <label
          className={`textButton operationImportUpload ${
            isRunning ? "disabled" : ""
          }`}
        >
          <Upload aria-hidden="true" size={17} />
          <span>
            {restoreDryRunState.currentBackupFileName ??
              "現行JSONを選択"}
          </span>
          <input
            accept="application/json,.json"
            className="srOnly"
            disabled={isRunning}
            onChange={onSelectCurrentBackupFile}
            type="file"
          />
        </label>

        <label className="operationRestoreTokenField">
          <span>確認トークン</span>
          <input
            autoCapitalize="off"
            autoComplete="off"
            disabled={isRunning}
            onChange={(event) =>
              onUpdateRestoreConfirmationToken(event.currentTarget.value)
            }
            placeholder={expectedToken}
            spellCheck={false}
            type="text"
            value={restoreDryRunState.confirmationToken}
          />
        </label>

        <button
          className="textButton primary"
          disabled={!canRun}
          onClick={() => void onRunRestoreDryRun()}
          type="button"
        >
          <PlayCircle aria-hidden="true" size={17} />
          <span>{isRunning ? "実行中" : "ドライラン"}</span>
        </button>
      </div>

      {restoreDryRunState.message && (
        <div
          className={`operationImportAlert ${messageClass}`}
          role="status"
        >
          <AlertCircle aria-hidden="true" size={17} />
          <p>{restoreDryRunState.message}</p>
        </div>
      )}

      {restoreDryRunState.report && (
        <OperationRestoreDryRunResult
          report={restoreDryRunState.report}
          timezone={timezone}
        />
      )}
    </div>
  );
}

function OperationRestoreDryRunResult({
  report,
  timezone,
}: {
  report: OperationsRestoreDryRunReport;
  timezone: string;
}) {
  const status = getImportStatusMeta(report.currentBackup.status);

  return (
    <div
      className={`operationRestoreDryRunResult ${
        report.canProceed ? "ready" : "blocked"
      }`}
    >
      <div className="operationRestoreDryRunFacts">
        <div>
          <span>実行判定</span>
          <strong>{report.canProceed ? "通過" : "停止"}</strong>
        </div>
        <div>
          <span>現行バックアップ</span>
          <strong>{status.label}</strong>
        </div>
        <div>
          <span>確認時刻</span>
          <strong>{formatFullDateTime(report.generatedAt, timezone)}</strong>
        </div>
      </div>

      <div className="operationRestoreDryRunGuards">
        <span>確認トークン</span>
        <strong>受理</strong>
        <span>現在件数</span>
        <strong>
          {report.currentBackup.matchesCurrentState ? "一致" : "差分"}
        </strong>
        <span>実復元</span>
        <strong>
          {report.guardrails.destructiveRestoreBlocked ? "未実行" : "許可"}
        </strong>
      </div>

      {report.currentBackup.issues.length > 0 && (
        <div className="operationImportIssues">
          {report.currentBackup.issues.map((issue) => (
            <OperationImportIssueItem issue={issue} key={issue.key} />
          ))}
        </div>
      )}
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

function createRestoreConfirmationToken(
  report: OperationsImportValidationReport,
) {
  if (!report.exportedAt) {
    return "";
  }

  const exportedAt = new Date(report.exportedAt);

  if (Number.isNaN(exportedAt.getTime())) {
    return "";
  }

  const dateToken = exportedAt.toISOString().slice(0, 10).replaceAll("-", "");

  return `RESTORE:${report.currentTenant.code}:${dateToken}`;
}

function getRestoreDryRunMessageClass(state: RestoreDryRunState) {
  if (state.status === "ready") {
    return "success";
  }

  if (state.status === "success" && state.report?.canProceed) {
    return "success";
  }

  return "";
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
