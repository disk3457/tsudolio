import type {
  DocumentInput,
  DocumentSnapshot,
  DocumentSummary,
} from "@/application/documents/types";
import type { MutationContext } from "@/application/security/types";

export type DocumentRepository = {
  getDocumentSnapshot: (tenantCode?: string) => Promise<DocumentSnapshot>;
  createDocument: (
    input: DocumentInput,
    context: MutationContext,
  ) => Promise<DocumentSummary>;
  updateDocument: (
    documentId: string,
    input: DocumentInput,
    context: MutationContext,
  ) => Promise<DocumentSummary>;
  deleteDocument: (
    documentId: string,
    context: MutationContext,
  ) => Promise<void>;
};

export function createDocumentUseCases(repository: DocumentRepository) {
  return {
    getDocumentSnapshot: repository.getDocumentSnapshot,
    createDocument: repository.createDocument,
    updateDocument: repository.updateDocument,
    deleteDocument: repository.deleteDocument,
  };
}
