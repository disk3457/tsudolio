"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  DocumentAccessResponse,
  DocumentAccessSummary,
  DocumentDeleteResponse,
  DocumentMutationResponse,
  DocumentsApiResponse,
  DocumentSummary,
} from "@/application/documents/types";
import {
  createDefaultDocumentFormState,
  documentFormToInput,
  documentToFormState,
} from "./form-state";
import {
  allDocumentCategoryKey,
  type DocumentFormState,
  type DocumentLoadState,
} from "./view-types";

export function useDocumentDirectory() {
  const [activeCategory, setActiveCategory] = useState(allDocumentCategoryKey);
  const [documentState, setDocumentState] = useState<DocumentLoadState>({
    snapshot: null,
    status: "loading",
    message: null,
    updatedAt: null,
  });
  const [formState, setFormState] = useState<DocumentFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [accessingId, setAccessingId] = useState<string | null>(null);
  const [accessResult, setAccessResult] =
    useState<DocumentAccessSummary | null>(null);
  const [selectedHistoryDocumentId, setSelectedHistoryDocumentId] = useState<
    string | null
  >(null);

  const loadDocuments = useCallback(async (signal?: AbortSignal) => {
    setDocumentState((current) => ({
      ...current,
      status: current.snapshot ? "ready" : "loading",
      message: null,
    }));

    try {
      const response = await fetch("/api/documents", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal,
      });
      const body = (await response.json()) as DocumentsApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "文書データを取得できませんでした",
        );
      }

      setDocumentState({
        snapshot: body.data,
        status: "ready",
        message: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setDocumentState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "文書データを取得できませんでした",
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadDocuments(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadDocuments]);

  const documents = useMemo(
    () => documentState.snapshot?.documents ?? [],
    [documentState.snapshot?.documents],
  );
  const categories = useMemo(
    () => documentState.snapshot?.categories ?? [],
    [documentState.snapshot?.categories],
  );
  const visibleDocuments = useMemo(
    () =>
      activeCategory === allDocumentCategoryKey
        ? documents
        : documents.filter((document) => document.category === activeCategory),
    [activeCategory, documents],
  );
  const activeDocuments = useMemo(
    () => documents.filter((document) => document.status === "ACTIVE"),
    [documents],
  );
  const reviewDocuments = useMemo(
    () => documents.filter((document) => document.status === "REVIEW"),
    [documents],
  );
  const versionCount = useMemo(
    () =>
      documents.reduce((count, document) => count + document.versionCount, 0),
    [documents],
  );
  const selectedHistoryDocument = useMemo(
    () =>
      documents.find((document) => document.id === selectedHistoryDocumentId) ??
      null,
    [documents, selectedHistoryDocumentId],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState) {
      return;
    }

    setSaving(true);
    setDocumentState((current) => ({ ...current, message: null }));

    try {
      const payload = documentFormToInput(formState);
      const response = await fetch(
        formState.id ? `/api/documents/${formState.id}` : "/api/documents",
        {
          method: formState.id ? "PATCH" : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as DocumentMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "文書を保存できませんでした",
        );
      }

      setFormState(null);
      setActiveCategory(allDocumentCategoryKey);
      await loadDocuments();
    } catch (error) {
      setDocumentState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "文書を保存できませんでした",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(document: DocumentSummary) {
    if (!window.confirm(`${document.title} を削除しますか？`)) {
      return;
    }

    setDeletingId(document.id);
    setDocumentState((current) => ({ ...current, message: null }));

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });
      const body = (await response.json()) as DocumentDeleteResponse;

      if (!response.ok || "error" in body) {
        throw new Error(
          "message" in body ? body.message : "文書を削除できませんでした",
        );
      }

      if (formState?.id === document.id) {
        setFormState(null);
      }

      await loadDocuments();
    } catch (error) {
      setDocumentState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "文書を削除できませんでした",
      }));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAccess(document: DocumentSummary) {
    setAccessingId(document.id);
    setDocumentState((current) => ({ ...current, message: null }));

    try {
      const response = await fetch(`/api/documents/${document.id}/access`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });
      const body = (await response.json()) as DocumentAccessResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "文書アクセスを記録できませんでした",
        );
      }

      setAccessResult(body.data);
    } catch (error) {
      setDocumentState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error
            ? error.message
            : "文書アクセスを記録できませんでした",
      }));
    } finally {
      setAccessingId(null);
    }
  }

  function openCreateForm() {
    setFormState(createDefaultDocumentFormState());
  }

  function openEditForm(document: DocumentSummary) {
    setFormState(documentToFormState(document));
  }

  function closeForm() {
    setFormState(null);
  }

  function closeAccessResult() {
    setAccessResult(null);
  }

  function toggleHistory(document: DocumentSummary) {
    setSelectedHistoryDocumentId((current) =>
      current === document.id ? null : document.id,
    );
  }

  function closeHistory() {
    setSelectedHistoryDocumentId(null);
  }

  function updateForm<Field extends keyof DocumentFormState>(
    field: Field,
    value: DocumentFormState[Field],
  ) {
    setFormState((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  return {
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
    organizationUnits: documentState.snapshot?.organizationUnits ?? [],
    reviewDocuments,
    saving,
    selectedHistoryDocument,
    selectedHistoryDocumentId,
    setActiveCategory,
    toggleHistory,
    updateForm,
    visibleDocuments,
    versionCount,
  };
}
