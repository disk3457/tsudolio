import type { FormEvent } from "react";
import { Building2, Save } from "lucide-react";
import { EmptyState } from "@/presentation/components/empty-state";
import {
  tenantTypeOptions,
  timezoneOptions,
} from "@/presentation/features/operations/form-state";
import type { useOperationsConsole } from "@/presentation/features/operations/use-operations-console";
import { formatFullDateTime } from "@/shared/formatters";

type OperationsConsoleState = ReturnType<typeof useOperationsConsole>;

export function TenantProfilePanel({
  operationsState,
  onSaveTenantProfile,
  onUpdateTenantForm,
  tenantForm,
  timezone,
}: {
  operationsState: OperationsConsoleState["operationsState"];
  onSaveTenantProfile: OperationsConsoleState["saveTenantProfile"];
  onUpdateTenantForm: OperationsConsoleState["updateTenantForm"];
  tenantForm: OperationsConsoleState["tenantForm"];
  timezone: string;
}) {
  const snapshot = operationsState.snapshot;

  async function submitTenantProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSaveTenantProfile();
  }

  return (
    <section className="panel operationsTenantPanel">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">Tenant</p>
          <h2>テナント基本情報</h2>
        </div>
        <Building2 aria-hidden="true" className="panelIcon" size={21} />
      </div>

      {snapshot ? (
        <form className="scheduleForm" onSubmit={submitTenantProfile}>
          <div className="formGrid">
            <label className="fieldControl">
              <span>テナントコード</span>
              <input readOnly value={snapshot.tenant.code} />
            </label>
            <label className="fieldControl wide">
              <span>正式名称</span>
              <input
                onChange={(event) =>
                  onUpdateTenantForm("name", event.target.value)
                }
                required
                value={tenantForm.name}
              />
            </label>
            <label className="fieldControl">
              <span>種別</span>
              <select
                onChange={(event) =>
                  onUpdateTenantForm(
                    "type",
                    event.target.value as typeof tenantForm.type,
                  )
                }
                value={tenantForm.type}
              >
                {tenantTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldControl wide">
              <span>表示名</span>
              <input
                onChange={(event) =>
                  onUpdateTenantForm("displayName", event.target.value)
                }
                value={tenantForm.displayName}
              />
            </label>
            <label className="fieldControl">
              <span>タイムゾーン</span>
              <select
                onChange={(event) =>
                  onUpdateTenantForm("timezone", event.target.value)
                }
                value={tenantForm.timezone}
              >
                {timezoneOptions.includes(tenantForm.timezone) ? null : (
                  <option value={tenantForm.timezone}>
                    {tenantForm.timezone}
                  </option>
                )}
                {timezoneOptions.map((timezoneOption) => (
                  <option key={timezoneOption} value={timezoneOption}>
                    {timezoneOption}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="formFooter">
            <p>
              更新日時 {formatFullDateTime(snapshot.tenant.updatedAt, timezone)}
            </p>
            <button
              className="textButton primary"
              disabled={operationsState.status === "saving"}
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              <span>
                {operationsState.status === "saving" ? "保存中" : "保存"}
              </span>
            </button>
          </div>
        </form>
      ) : (
        <EmptyState
          description="運用管理データを読み込めませんでした。"
          title={
            operationsState.status === "loading"
              ? "テナント情報を取得しています"
              : "表示できるテナント情報がありません"
          }
        />
      )}
    </section>
  );
}
