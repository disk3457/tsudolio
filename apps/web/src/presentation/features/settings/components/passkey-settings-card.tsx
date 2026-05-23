"use client";

import {
  Check,
  Fingerprint,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { PasskeySummary } from "@/application/security/types";
import {
  formatOptionalDate,
  formatPasskeyDate,
  formatPasskeyDevice,
  formatPasskeyTransports,
} from "@/presentation/features/settings/passkey-formatters";
import type { PasskeySaveState } from "@/presentation/features/settings/settings-types";

type PasskeySettingsCardProps = {
  busy: boolean;
  editingPasskeyId: string | null;
  editingPasskeyName: string;
  passkeys: PasskeySummary[];
  passkeysLoaded: boolean;
  passkeyName: string;
  registrationDisabled: boolean;
  state: PasskeySaveState;
  webAuthnSupported: boolean;
  onCancelRename: () => void;
  onDelete: (passkey: PasskeySummary) => void;
  onEditingNameChange: (value: string) => void;
  onRegister: () => void;
  onRegistrationNameChange: (value: string) => void;
  onRename: (passkey: PasskeySummary) => void;
  onStartRename: (passkey: PasskeySummary) => void;
};

export function PasskeySettingsCard({
  busy,
  editingPasskeyId,
  editingPasskeyName,
  passkeys,
  passkeysLoaded,
  passkeyName,
  registrationDisabled,
  state,
  webAuthnSupported,
  onCancelRename,
  onDelete,
  onEditingNameChange,
  onRegister,
  onRegistrationNameChange,
  onRename,
  onStartRename,
}: PasskeySettingsCardProps) {
  return (
    <article className="panel settingCard passkeySettingsCard">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">認証</p>
          <h2>Passkey</h2>
        </div>
        <Fingerprint aria-hidden="true" className="panelIcon" size={21} />
      </div>
      <div className="passkeyRegistrationControls">
        <label className="fieldControl">
          <span>表示名</span>
          <input
            disabled={registrationDisabled}
            maxLength={120}
            onChange={(event) => onRegistrationNameChange(event.target.value)}
            placeholder="この端末"
            value={passkeyName}
          />
        </label>
        <button
          className="textButton primary"
          disabled={registrationDisabled}
          onClick={onRegister}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          {state.status === "registering" ? "登録中" : "登録"}
        </button>
      </div>
      {!webAuthnSupported && (
        <p className="settingsNotice error" role="status">
          このブラウザではPasskeyを利用できません。
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
      {passkeys.length > 0 ? (
        <ul className="passkeyList">
          {passkeys.map((passkey) => (
            <li className="passkeyItem" key={passkey.id}>
              {editingPasskeyId === passkey.id ? (
                <label className="passkeyEditControl">
                  <span className="srOnly">Passkey表示名</span>
                  <input
                    autoFocus
                    disabled={busy}
                    maxLength={120}
                    onChange={(event) =>
                      onEditingNameChange(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onRename(passkey);
                      }
                      if (event.key === "Escape") {
                        onCancelRename();
                      }
                    }}
                    value={editingPasskeyName}
                  />
                </label>
              ) : (
                <span className="passkeySummary">
                  <strong>{passkey.name}</strong>
                  <small>登録: {formatPasskeyDate(passkey.createdAt)}</small>
                  <small>最終利用: {formatOptionalDate(passkey.lastUsedAt)}</small>
                  <small>
                    {formatPasskeyDevice(passkey)} /{" "}
                    {formatPasskeyTransports(passkey.transports)}
                  </small>
                </span>
              )}
              <div className="passkeyActions">
                {editingPasskeyId === passkey.id ? (
                  <>
                    <button
                      aria-label={`${passkey.name}の名前を保存`}
                      className="iconButton"
                      disabled={busy}
                      onClick={() => onRename(passkey)}
                      title="保存"
                      type="button"
                    >
                      <Check aria-hidden="true" size={16} />
                    </button>
                    <button
                      aria-label={`${passkey.name}の編集をキャンセル`}
                      className="iconButton"
                      disabled={busy}
                      onClick={onCancelRename}
                      title="キャンセル"
                      type="button"
                    >
                      <X aria-hidden="true" size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      aria-label={`${passkey.name}の名前を編集`}
                      className="iconButton"
                      disabled={busy}
                      onClick={() => onStartRename(passkey)}
                      title="名前を編集"
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={16} />
                    </button>
                    <button
                      aria-label={`${passkey.name}を削除`}
                      className="iconButton"
                      disabled={busy}
                      onClick={() => onDelete(passkey)}
                      title="削除"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="passkeyEmpty">
          {passkeysLoaded ? "未登録" : "確認中"}
        </p>
      )}
    </article>
  );
}
