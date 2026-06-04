import type { FormEvent } from "react";
import { Save, Send, X } from "lucide-react";
import type {
  WorkflowOption,
  WorkflowPriorityValue,
} from "@/application/workflows/types";
import type {
  WorkflowFormState,
  WorkflowSaveAction,
} from "@/presentation/features/workflows/view-types";

const priorityOptions: Array<{ key: WorkflowPriorityValue; label: string }> = [
  { key: "LOW", label: "低" },
  { key: "NORMAL", label: "通常" },
  { key: "HIGH", label: "高" },
  { key: "URGENT", label: "緊急" },
];

type WorkflowFormProps = {
  categories: string[];
  form: WorkflowFormState | null;
  onCancel: () => void;
  onSubmit: (action: WorkflowSaveAction) => void;
  onUpdateField: <Field extends keyof WorkflowFormState>(
    field: Field,
    value: WorkflowFormState[Field],
  ) => void;
  organizationUnits: WorkflowOption[];
  savingAction: WorkflowSaveAction | null;
};

export function WorkflowForm({
  categories,
  form,
  onCancel,
  onSubmit,
  onUpdateField,
  organizationUnits,
  savingAction,
}: WorkflowFormProps) {
  if (!form) {
    return null;
  }

  function submitWithAction(
    event: FormEvent<HTMLFormElement>,
    action: WorkflowSaveAction,
  ) {
    event.preventDefault();
    onSubmit(action);
  }

  return (
    <form
      className="panel scheduleForm workflowApplicationForm"
      onSubmit={(event) => submitWithAction(event, "SUBMIT")}
    >
      <div className="panelHeader compact">
        <div>
          <p className="sectionLabel">申請フォーム</p>
          <h2>申請を作成</h2>
        </div>
        <button
          className="iconButton"
          aria-label="申請フォームを閉じる"
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
            maxLength={220}
            onChange={(event) => onUpdateField("title", event.target.value)}
            required
            value={form.title}
          />
        </label>
        <label className="fieldControl">
          <span>分類</span>
          <select
            onChange={(event) => onUpdateField("category", event.target.value)}
            required
            value={form.category}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="fieldControl">
          <span>優先度</span>
          <select
            onChange={(event) =>
              onUpdateField(
                "priority",
                event.target.value as WorkflowPriorityValue,
              )
            }
            value={form.priority}
          >
            {priorityOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="fieldControl wide">
          <span>申請組織</span>
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
          <span>期限</span>
          <input
            onChange={(event) => onUpdateField("dueAt", event.target.value)}
            type="datetime-local"
            value={form.dueAt}
          />
        </label>
        <label className="fieldControl workflowDescriptionField">
          <span>申請内容</span>
          <textarea
            maxLength={4000}
            onChange={(event) =>
              onUpdateField("description", event.target.value)
            }
            rows={4}
            value={form.description}
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
          <button
            className="textButton"
            disabled={savingAction !== null}
            formNoValidate
            onClick={(event) => {
              event.preventDefault();
              onSubmit("DRAFT");
            }}
            type="submit"
          >
            <Save aria-hidden="true" size={16} />
            {savingAction === "DRAFT" ? "保存中" : "下書き保存"}
          </button>
          <button
            className="textButton primary"
            disabled={savingAction !== null}
            type="submit"
          >
            <Send aria-hidden="true" size={16} />
            {savingAction === "SUBMIT" ? "提出中" : "提出"}
          </button>
        </div>
      </div>
    </form>
  );
}
