import type { FormEvent } from "react";
import { Save, X } from "lucide-react";
import type {
  DocumentOption,
  DocumentStatus,
} from "@/features/documents/types";
import type { DocumentFormState } from "./view-types";

const statusOptions: Array<{ key: DocumentStatus; label: string }> = [
  { key: "DRAFT", label: "下書き" },
  { key: "REVIEW", label: "確認中" },
  { key: "ACTIVE", label: "最新版" },
  { key: "ARCHIVED", label: "保管済み" },
];

type DocumentFormProps = {
  form: DocumentFormState | null;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateField: <Field extends keyof DocumentFormState>(
    field: Field,
    value: DocumentFormState[Field],
  ) => void;
  organizationUnits: DocumentOption[];
  saving: boolean;
};

export function DocumentForm({
  form,
  onCancel,
  onSubmit,
  onUpdateField,
  organizationUnits,
  saving,
}: DocumentFormProps) {
  if (!form) {
    return null;
  }

  return (
    <form className="panel scheduleForm" onSubmit={onSubmit}>
      <div className="panelHeader compact">
        <div>
          <p className="sectionLabel">{form.id ? "文書更新" : "新規文書"}</p>
          <h2>{form.id ? "文書を編集" : "文書を登録"}</h2>
        </div>
        <button
          className="iconButton"
          aria-label="文書フォームを閉じる"
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="formGrid">
        <label className="fieldControl wide">
          <span>文書名</span>
          <input
            maxLength={220}
            onChange={(event) => onUpdateField("title", event.target.value)}
            required
            value={form.title}
          />
        </label>
        <label className="fieldControl">
          <span>分類</span>
          <input
            maxLength={120}
            onChange={(event) => onUpdateField("category", event.target.value)}
            required
            value={form.category}
          />
        </label>
        <label className="fieldControl">
          <span>版</span>
          <input
            maxLength={40}
            onChange={(event) => onUpdateField("version", event.target.value)}
            required
            value={form.version}
          />
        </label>
        <label className="fieldControl">
          <span>状態</span>
          <select
            onChange={(event) =>
              onUpdateField("status", event.target.value as DocumentStatus)
            }
            value={form.status}
          >
            {statusOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="fieldControl">
          <span>保管期限</span>
          <input
            onChange={(event) =>
              onUpdateField("retentionUntil", event.target.value)
            }
            type="date"
            value={form.retentionUntil}
          />
        </label>
        <label className="fieldControl wide">
          <span>管理組織</span>
          <select
            onChange={(event) =>
              onUpdateField("organizationUnitId", event.target.value)
            }
            value={form.organizationUnitId}
          >
            <option value="">未指定</option>
            {organizationUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <label className="fieldControl wide">
          <span>保管キー</span>
          <input
            maxLength={500}
            onChange={(event) => onUpdateField("storageKey", event.target.value)}
            required
            value={form.storageKey}
          />
        </label>
      </div>

      <div className="formFooter">
        <span />
        <div className="actionRow">
          <button className="textButton" onClick={onCancel} type="button">
            <X aria-hidden="true" size={16} />
            キャンセル
          </button>
          <button className="textButton primary" disabled={saving} type="submit">
            <Save aria-hidden="true" size={16} />
            {saving ? "保存中" : "保存"}
          </button>
        </div>
      </div>
    </form>
  );
}
