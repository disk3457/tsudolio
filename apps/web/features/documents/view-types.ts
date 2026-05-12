import type { DocumentSnapshot, DocumentStatus } from "./types";

export const allDocumentCategoryKey = "all";

export type DocumentLoadState = {
  snapshot: DocumentSnapshot | null;
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

export type DocumentFormState = {
  id: string | null;
  title: string;
  category: string;
  version: string;
  status: DocumentStatus;
  storageKey: string;
  retentionUntil: string;
  organizationUnitId: string;
};
