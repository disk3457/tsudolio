"use client";

import { AlertCircle } from "lucide-react";
import {
  DocumentAccessPanel,
  DocumentHistoryPanel,
} from "@/presentation/features/documents/document-detail-panels";
import { DocumentForm } from "@/presentation/features/documents/document-form";
import { DocumentStats } from "@/presentation/features/documents/document-stats";
import { DocumentTable } from "@/presentation/features/documents/document-table";
import { DocumentToolbar } from "@/presentation/features/documents/document-toolbar";
import { useDocumentDirectory } from "@/presentation/features/documents/use-document-directory";

export function DocumentsView() {
  const {
    activeCategory,
    activeDocuments,
    accessingId,
    accessResult,
    categories,
    closeAccessResult,
    closeForm,
    closeHistory,
    deletingId,
    documentState,
    documents,
    formState,
    handleAccess,
    handleDelete,
    handleSubmit,
    loadDocuments,
    openCreateForm,
    openEditForm,
    organizationUnits,
    reviewDocuments,
    saving,
    selectedHistoryDocument,
    selectedHistoryDocumentId,
    setActiveCategory,
    toggleHistory,
    updateForm,
    visibleDocuments,
    versionCount,
  } = useDocumentDirectory();

  return (
    <section className="viewStack">
      <DocumentToolbar
        activeCategory={activeCategory}
        categories={categories}
        onActiveCategoryChange={setActiveCategory}
        onOpenCreateForm={openCreateForm}
        onRefresh={() => void loadDocuments()}
      />

      {documentState.message && (
        <div className="viewAlert" role="alert">
          <AlertCircle aria-hidden="true" size={18} />
          <p>{documentState.message}</p>
        </div>
      )}

      <DocumentForm
        form={formState}
        onCancel={closeForm}
        onSubmit={(event) => void handleSubmit(event)}
        onUpdateField={updateForm}
        organizationUnits={organizationUnits}
        saving={saving}
      />

      <DocumentStats
        activeCount={activeDocuments.length}
        documentCount={documents.length}
        reviewCount={reviewDocuments.length}
        versionCount={versionCount}
      />

      <DocumentTable
        activeCategory={activeCategory}
        accessingId={accessingId}
        deletingId={deletingId}
        documents={visibleDocuments}
        onAccess={(document) => void handleAccess(document)}
        onDelete={(document) => void handleDelete(document)}
        onEdit={openEditForm}
        onToggleHistory={toggleHistory}
        selectedHistoryDocumentId={selectedHistoryDocumentId}
        status={documentState.status}
      />

      <DocumentAccessPanel access={accessResult} onClose={closeAccessResult} />

      <DocumentHistoryPanel
        document={selectedHistoryDocument}
        onClose={closeHistory}
      />
    </section>
  );
}
