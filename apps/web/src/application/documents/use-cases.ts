import type {
  DocumentInput,
  DocumentSnapshot,
  DocumentSummary,
} from "@/application/documents/types";

export type DocumentRepository = {
  getDocumentSnapshot: (tenantCode?: string) => Promise<DocumentSnapshot>;
  createDocument: (
    input: DocumentInput,
    tenantCode?: string,
  ) => Promise<DocumentSummary>;
  updateDocument: (
    documentId: string,
    input: DocumentInput,
    tenantCode?: string,
  ) => Promise<DocumentSummary>;
  deleteDocument: (documentId: string, tenantCode?: string) => Promise<void>;
};

export function createDocumentUseCases(repository: DocumentRepository) {
  return {
    getDocumentSnapshot: repository.getDocumentSnapshot,
    createDocument: repository.createDocument,
    updateDocument: repository.updateDocument,
    deleteDocument: repository.deleteDocument,
  };
}
