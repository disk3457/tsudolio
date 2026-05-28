import { Archive } from "lucide-react";
import {
  auditLogRetentionDayOptions,
  defaultAuditLogRetentionDays,
  type AuditLogRetentionDays,
  type AuditRetentionLoadState,
} from "@/application/audit/types";
import type { PasskeyStepUpState } from "@/presentation/features/auth/use-passkey-step-up";
import { formatFullDateTime, formatNumber } from "@/shared/formatters";

const retentionOptions: Array<{
  label: string;
  value: AuditLogRetentionDays;
}> = [
  { label: "90日", value: 90 },
  { label: "180日", value: 180 },
  { label: "1年", value: 365 },
  { label: "3年", value: 1095 },
  { label: "7年", value: 2555 },
];

export function AuditRetentionControl({
  onChange,
  state,
  stepUpState,
  timezone,
}: {
  onChange: (retentionDays: AuditLogRetentionDays) => Promise<void>;
  state: AuditRetentionLoadState;
  stepUpState: PasskeyStepUpState;
  timezone: string;
}) {
  const policy = state.snapshot;
  const retentionDays = policy?.retentionDays ?? defaultAuditLogRetentionDays;
  const busy =
    state.status === "loading" ||
    state.status === "saving" ||
    stepUpState.status === "verifying";

  return (
    <div className="auditRetentionCard">
      <div className="auditRetentionHeader">
        <Archive aria-hidden="true" size={20} />
        <span>
          <strong>監査ログ保持</strong>
          <small>
            {policy ? formatRetentionDays(policy.retentionDays) : "確認中"}
          </small>
        </span>
      </div>

      <label className="fieldControl">
        <span>保持期間</span>
        <select
          disabled={!policy || busy}
          onChange={(event) =>
            void onChange(
              Number(event.currentTarget.value) as AuditLogRetentionDays,
            )
          }
          value={retentionDays}
        >
          {auditLogRetentionDayOptions.map((value) => (
            <option key={value} value={value}>
              {formatRetentionDays(value)}
            </option>
          ))}
        </select>
      </label>

      <div className="auditRetentionMetrics">
        <span>
          <strong>
            {policy ? formatNumber(policy.retainedEventCount) : "確認中"}
          </strong>
          <small>保持対象</small>
        </span>
        <span>
          <strong>
            {policy ? formatNumber(policy.expiredEventCount) : "確認中"}
          </strong>
          <small>保持対象外</small>
        </span>
        <span>
          <strong>
            {policy ? formatNumber(policy.totalEventCount) : "確認中"}
          </strong>
          <small>総件数</small>
        </span>
      </div>

      {policy && (
        <dl className="auditRetentionDates">
          <div>
            <dt>保持開始</dt>
            <dd>{formatFullDateTime(policy.retainedSince, timezone)}</dd>
          </div>
          <div>
            <dt>最古</dt>
            <dd>{formatOptionalDateTime(policy.oldestEventAt, timezone)}</dd>
          </div>
          <div>
            <dt>最新</dt>
            <dd>{formatOptionalDateTime(policy.newestEventAt, timezone)}</dd>
          </div>
        </dl>
      )}

      {state.message && (
        <p
          className={`settingsNotice ${
            state.status === "error" ? "error" : "success"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
      {stepUpState.message && (
        <p
          className={`settingsNotice ${
            stepUpState.status === "error" ? "error" : "success"
          }`}
          role={stepUpState.status === "error" ? "alert" : "status"}
        >
          {stepUpState.message}
        </p>
      )}
    </div>
  );
}

function formatRetentionDays(value: AuditLogRetentionDays) {
  return (
    retentionOptions.find((option) => option.value === value)?.label ??
    `${value}日`
  );
}

function formatOptionalDateTime(value: string | null, timezone: string) {
  return value ? formatFullDateTime(value, timezone) : "なし";
}
