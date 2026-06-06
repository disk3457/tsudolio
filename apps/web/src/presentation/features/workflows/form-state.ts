import type { WorkflowRequestInput } from "@/application/workflows/types";
import type {
  WorkflowFormState,
  WorkflowSaveAction,
} from "@/presentation/features/workflows/view-types";

export function createDefaultWorkflowFormState(
  category = "その他",
): WorkflowFormState {
  return {
    title: "",
    category,
    description: "",
    organizationUnitId: "",
    priority: "NORMAL",
    dueAt: formatDateTimeInput(addDays(new Date(), 2).toISOString()),
  };
}

export function workflowFormToInput(
  form: WorkflowFormState,
  action: WorkflowSaveAction,
): WorkflowRequestInput {
  return {
    title: form.title,
    category: form.category,
    description: form.description || null,
    organizationUnitId: form.organizationUnitId || null,
    priority: form.priority,
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    action,
  };
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(17, 0, 0, 0);

  return nextDate;
}

function formatDateTimeInput(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
