"use client";

import { AlertCircle, FileDown, RefreshCw } from "lucide-react";
import { OperationBackupPanel } from "@/presentation/features/operations/components/operation-backup-panel";
import { OperationEventsPanel } from "@/presentation/features/operations/components/operation-events-panel";
import { OperationHardeningPanel } from "@/presentation/features/operations/components/operation-hardening-panel";
import { OperationHealthPanel } from "@/presentation/features/operations/components/operation-health-panel";
import { OperationMetricCard } from "@/presentation/features/operations/components/operation-metric-card";
import { TenantProfilePanel } from "@/presentation/features/operations/components/tenant-profile-panel";
import { useOperationsConsole } from "@/presentation/features/operations/use-operations-console";
import { createLoadingMetrics } from "@/presentation/features/operations/view-helpers";

export function OperationsView() {
  const {
    exportPath,
    importValidationState,
    loadOperations,
    operationsState,
    saveTenantProfile,
    tenantForm,
    updateTenantForm,
    validateImportFile,
  } = useOperationsConsole();
  const snapshot = operationsState.snapshot;
  const timezone = snapshot?.tenant.timezone ?? "Asia/Tokyo";

  return (
    <section className="viewStack operationsWorkspace">
      <div className="viewToolbar">
        <div>
          <p className="sectionLabel">Operations</p>
          <h2>運用管理コンソール</h2>
        </div>
        <div className="toolbarActions">
          <a
            aria-label="運用データをJSONでエクスポート"
            className="textButton"
            href={exportPath}
          >
            <FileDown aria-hidden="true" size={17} />
            <span>JSON</span>
          </a>
          <button
            aria-label="運用管理データを更新"
            className="iconButton"
            onClick={() => void loadOperations()}
            title="更新"
            type="button"
          >
            <RefreshCw aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      {operationsState.message && (
        <div
          className={`viewAlert ${
            operationsState.status === "ready" ? "success" : ""
          }`}
          role="status"
        >
          <AlertCircle aria-hidden="true" size={18} />
          <p>{operationsState.message}</p>
        </div>
      )}

      <div className="operationsStats" aria-label="運用指標">
        {(snapshot?.metrics ?? createLoadingMetrics()).map((metric) => (
          <OperationMetricCard key={metric.key} metric={metric} />
        ))}
      </div>

      <div className="operationsGrid">
        <TenantProfilePanel
          onSaveTenantProfile={saveTenantProfile}
          onUpdateTenantForm={updateTenantForm}
          operationsState={operationsState}
          tenantForm={tenantForm}
          timezone={timezone}
        />

        <OperationBackupPanel
          importValidationState={importValidationState}
          onValidateImportFile={validateImportFile}
          snapshot={snapshot}
          timezone={timezone}
        />

        <OperationHealthPanel
          checks={snapshot?.healthChecks ?? []}
          isLoading={operationsState.status === "loading"}
          timezone={timezone}
        />

        <OperationHardeningPanel
          checklist={snapshot?.hardening ?? null}
          isLoading={operationsState.status === "loading"}
          timezone={timezone}
        />

        <OperationEventsPanel
          events={snapshot?.recentEvents ?? []}
          hasSnapshot={Boolean(snapshot)}
          timezone={timezone}
        />
      </div>
    </section>
  );
}
