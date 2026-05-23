"use client";

import { Copy, RefreshCw, ShieldCheck } from "lucide-react";
import type { RecoveryCodeSummary } from "@/application/security/types";
import { formatOptionalDate } from "@/presentation/features/settings/passkey-formatters";
import type { RecoveryCodeSaveState } from "@/presentation/features/settings/settings-types";

type RecoveryCodeSettingsCardProps = {
  generatedCodes: string[];
  generateDisabled: boolean;
  passkeyRequired: boolean;
  recoveryCodes: RecoveryCodeSummary | null;
  state: RecoveryCodeSaveState;
  onCopy: () => void;
  onGenerate: () => void;
};

export function RecoveryCodeSettingsCard({
  generatedCodes,
  generateDisabled,
  passkeyRequired,
  recoveryCodes,
  state,
  onCopy,
  onGenerate,
}: RecoveryCodeSettingsCardProps) {
  return (
    <article className="panel settingCard recoveryCodeSettingsCard">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">認証</p>
          <h2>リカバリーコード</h2>
        </div>
        <ShieldCheck aria-hidden="true" className="panelIcon" size={21} />
      </div>
      <div className="recoveryCodeMetrics">
        <span>
          <strong>{recoveryCodes?.activeCount ?? 0}</strong>
          <small>未使用</small>
        </span>
        <span>
          <strong>{recoveryCodes?.usedCount ?? 0}</strong>
          <small>使用済み</small>
        </span>
        <span>
          <strong>{recoveryCodes?.revokedCount ?? 0}</strong>
          <small>失効</small>
        </span>
      </div>
      {passkeyRequired && (
        <p className="settingsNotice error" role="status">
          Passkey登録後に発行できます。
        </p>
      )}
      {state.message && (
        <p
          className={`settingsNotice ${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
      {generatedCodes.length > 0 && (
        <div className="recoveryCodeVault">
          <ol>
            {generatedCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ol>
          <button className="textButton" onClick={onCopy} type="button">
            <Copy aria-hidden="true" size={16} />
            コピー
          </button>
        </div>
      )}
      <div className="formFooter">
        <p>最終発行: {formatOptionalDate(recoveryCodes?.lastGeneratedAt)}</p>
        <button
          className="textButton primary"
          disabled={generateDisabled}
          onClick={onGenerate}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={16} />
          {state.status === "generating"
            ? "発行中"
            : recoveryCodes && recoveryCodes.activeCount > 0
              ? "再発行"
              : "発行"}
        </button>
      </div>
    </article>
  );
}
