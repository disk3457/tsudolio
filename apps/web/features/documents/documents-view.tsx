"use client";

import { AlertCircle } from "lucide-react";
import { DocumentForm } from "@/features/documents/document-form";
import { DocumentStats } from "@/features/documents/document-stats";
import { DocumentTable } from "@/features/documents/document-table";
import { DocumentToolbar } from "@/features/documents/document-toolbar";
import { useDocumentDirectory } from "@/features/documents/use-document-directory";

export function DocumentsView() {
  const {
    activeCategory,
    activeDocuments,
    categories,
    closeForm,
    deletingId,
    documentState,
    documents,
    formState,
    handleDelete,
    handleSubmit,
    loadDocuments,
    openCreateForm,
    openEditForm,
    organizationUnits,
    reviewDocuments,
    saving,
    setActiveCategory,
    updateForm,
    visibleDocuments,
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
        categoryCount={categories.length}
        documentCount={documents.length}
        reviewCount={reviewDocuments.length}
      />

      <DocumentTable
        activeCategory={activeCategory}
        deletingId={deletingId}
        documents={visibleDocuments}
        onDelete={(document) => void handleDelete(document)}
        onEdit={openEditForm}
        status={documentState.status}
      />
    </section>
  );
}
