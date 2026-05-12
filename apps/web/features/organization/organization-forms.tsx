import type { FormEvent } from "react";
import { Save, X } from "lucide-react";
import type {
  OrganizationUnitKind,
  OrganizationUnitSummary,
} from "@/features/organization/types";
import type { UnitFormState, UserFormState } from "./view-types";

const kindOptions: Array<{ key: OrganizationUnitKind; label: string }> = [
  { key: "DEPARTMENT", label: "部署" },
  { key: "WARD", label: "病棟" },
  { key: "BRANCH", label: "支店" },
  { key: "TEAM", label: "チーム" },
  { key: "EXTERNAL_PARTNER", label: "外部連携" },
];

type OrganizationUnitFormProps = {
  form: UnitFormState | null;
  formUnits: OrganizationUnitSummary[];
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateField: <Field extends keyof UnitFormState>(
    field: Field,
    value: UnitFormState[Field],
  ) => void;
  saving: boolean;
};

export function OrganizationUnitForm({
  form,
  formUnits,
  onCancel,
  onSubmit,
  onUpdateField,
  saving,
}: OrganizationUnitFormProps) {
  if (!form) {
    return null;
  }

  return (
    <form className="panel scheduleForm" onSubmit={onSubmit}>
      <div className="panelHeader compact">
        <div>
          <p className="sectionLabel">{form.id ? "組織更新" : "新規組織"}</p>
          <h2>{form.id ? "組織を編集" : "組織を登録"}</h2>
        </div>
        <button
          className="iconButton"
          aria-label="組織フォームを閉じる"
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="formGrid">
        <label className="fieldControl">
          <span>組織コード</span>
          <input
            maxLength={80}
            onChange={(event) => onUpdateField("code", event.target.value)}
            required
            value={form.code}
          />
        </label>
        <label className="fieldControl wide">
          <span>組織名</span>
          <input
            maxLength={160}
            onChange={(event) => onUpdateField("name", event.target.value)}
            required
            value={form.name}
          />
        </label>
        <label className="fieldControl">
          <span>表示順</span>
          <input
            min={0}
            onChange={(event) => onUpdateField("sortOrder", event.target.value)}
            type="number"
            value={form.sortOrder}
          />
        </label>
        <label className="fieldControl">
          <span>種別</span>
          <select
            onChange={(event) =>
              onUpdateField("kind", event.target.value as OrganizationUnitKind)
            }
            value={form.kind}
          >
            {kindOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="fieldControl wide">
          <span>親組織</span>
          <select
            onChange={(event) => onUpdateField("parentId", event.target.value)}
            value={form.parentId}
          >
            <option value="">なし</option>
            {formUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FormFooter disabled={saving} onCancel={onCancel} saving={saving} />
    </form>
  );
}

type UserFormProps = {
  form: UserFormState | null;
  organizationUnits: OrganizationUnitSummary[];
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateField: <Field extends keyof UserFormState>(
    field: Field,
    value: UserFormState[Field],
  ) => void;
  saving: boolean;
};

export function UserForm({
  form,
  organizationUnits,
  onCancel,
  onSubmit,
  onUpdateField,
  saving,
}: UserFormProps) {
  if (!form) {
    return null;
  }

  return (
    <form className="panel scheduleForm" onSubmit={onSubmit}>
      <div className="panelHeader compact">
        <div>
          <p className="sectionLabel">{form.id ? "利用者更新" : "新規利用者"}</p>
          <h2>{form.id ? "利用者を編集" : "利用者を登録"}</h2>
        </div>
        <button
          className="iconButton"
          aria-label="利用者フォームを閉じる"
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="formGrid">
        <label className="fieldControl wide">
          <span>表示名</span>
          <input
            maxLength={120}
            onChange={(event) => onUpdateField("displayName", event.target.value)}
            required
            value={form.displayName}
          />
        </label>
        <label className="fieldControl wide">
          <span>メールアドレス</span>
          <input
            maxLength={254}
            onChange={(event) => onUpdateField("email", event.target.value)}
            required
            type="email"
            value={form.email}
          />
        </label>
        <label className="fieldControl">
          <span>カナ氏名</span>
          <input
            maxLength={120}
            onChange={(event) => onUpdateField("kanaName", event.target.value)}
            value={form.kanaName}
          />
        </label>
        <label className="fieldControl">
          <span>役職</span>
          <input
            maxLength={120}
            onChange={(event) => onUpdateField("title", event.target.value)}
            value={form.title}
          />
        </label>
        <label className="fieldControl wide">
          <span>所属組織</span>
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
        <label className="checkControl">
          <input
            checked={form.isSystemAdmin}
            onChange={(event) =>
              onUpdateField("isSystemAdmin", event.target.checked)
            }
            type="checkbox"
          />
          <span>システム管理者</span>
        </label>
      </div>
      <FormFooter disabled={saving} onCancel={onCancel} saving={saving} />
    </form>
  );
}

function FormFooter({
  disabled,
  onCancel,
  saving,
}: {
  disabled: boolean;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="formFooter">
      <span />
      <div className="actionRow">
        <button className="textButton" onClick={onCancel} type="button">
          <X aria-hidden="true" size={16} />
          キャンセル
        </button>
        <button className="textButton primary" disabled={disabled} type="submit">
          <Save aria-hidden="true" size={16} />
          {saving ? "保存中" : "保存"}
        </button>
      </div>
    </div>
  );
}
