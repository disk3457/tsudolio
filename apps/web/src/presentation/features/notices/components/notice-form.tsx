import type { FormEvent } from "react";
import { Save, X } from "lucide-react";
import type { NoticeOption } from "@/application/notices/types";
import type { NoticeFormState } from "@/presentation/features/notices/view-types";

type NoticeFormProps = {
  form: NoticeFormState | null;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateField: <Field extends keyof NoticeFormState>(
    field: Field,
    value: NoticeFormState[Field],
  ) => void;
  organizationUnits: NoticeOption[];
  saving: boolean;
};

export function NoticeForm({
  form,
  onCancel,
  onSubmit,
  onUpdateField,
  organizationUnits,
  saving,
}: NoticeFormProps) {
  if (!form) {
    return null;
  }

  return (
    <form className="panel scheduleForm noticeForm" onSubmit={onSubmit}>
      <div className="panelHeader compact">
        <div>
          <p className="sectionLabel">{form.id ? "掲示更新" : "新規掲示"}</p>
          <h2>{form.id ? "掲示を編集" : "掲示を作成"}</h2>
        </div>
        <button
          className="iconButton"
          aria-label="掲示フォームを閉じる"
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="formGrid">
        <label className="fieldControl wide">
          <span>件名</span>
          <input
            maxLength={200}
            onChange={(event) => onUpdateField("title", event.target.value)}
            required
            value={form.title}
          />
        </label>
        <label className="fieldControl wide">
          <span>対象組織</span>
          <select
            onChange={(event) =>
              onUpdateField("organizationUnitId", event.target.value)
            }
            value={form.organizationUnitId}
          >
            <option value="">全体</option>
            {organizationUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <label className="fieldControl wide">
          <span>公開日時</span>
          <input
            onChange={(event) =>
              onUpdateField("publishedAt", event.target.value)
            }
            required
            type="datetime-local"
            value={form.publishedAt}
          />
        </label>
        <label className="fieldControl wide">
          <span>掲載終了</span>
          <input
            onChange={(event) => onUpdateField("expiresAt", event.target.value)}
            type="datetime-local"
            value={form.expiresAt}
          />
        </label>
        <label className="checkControl noticeAckControl">
          <input
            checked={form.requiresAck}
            onChange={(event) =>
              onUpdateField("requiresAck", event.target.checked)
            }
            type="checkbox"
          />
          <span>確認を必須にする</span>
        </label>
        <label className="fieldControl noticeBodyField">
          <span>本文</span>
          <textarea
            maxLength={4000}
            onChange={(event) => onUpdateField("body", event.target.value)}
            required
            value={form.body}
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
