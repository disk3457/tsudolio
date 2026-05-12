import type {
  DocumentInput,
  DocumentSummary,
} from "@/features/documents/types";
import type { DocumentFormState } from "./view-types";

export function createDefaultDocumentFormState(): DocumentFormState {
  return {
    id: null,
    title: "",
    category: "",
    version: "v1.0",
    status: "DRAFT",
    storageKey: "documents/",
    retentionUntil: "",
    organizationUnitId: "",
  };
}

export function documentToFormState(
  document: DocumentSummary,
): DocumentFormState {
  return {
    id: document.id,
    title: document.title,
    category: document.category,
    version: document.version,
    status: document.status,
    storageKey: document.storageKey,
    retentionUntil: formatDateInput(document.retentionUntil),
    organizationUnitId: document.organizationUnit?.id ?? "",
  };
}

export function documentFormToInput(
  formState: DocumentFormState,
): DocumentInput {
  return {
    title: formState.title,
    category: formState.category,
    version: formState.version,
    status: formState.status,
    storageKey: formState.storageKey,
    retentionUntil: formState.retentionUntil || null,
    organizationUnitId: formState.organizationUnitId || null,
  };
}

function formatDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}
