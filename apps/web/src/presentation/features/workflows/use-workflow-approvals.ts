"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  WorkflowDecisionInput,
  WorkflowMutationResponse,
  WorkflowRequestSummary,
  WorkflowsApiResponse,
} from "@/application/workflows/types";
import {
  createDefaultWorkflowFormState,
  workflowFormToInput,
} from "@/presentation/features/workflows/form-state";
import type {
  WorkflowFormState,
  WorkflowLoadState,
  WorkflowSaveAction,
  WorkflowTab,
} from "@/presentation/features/workflows/view-types";

const decisionLabels: Record<WorkflowDecisionInput["status"], string> = {
  APPROVED: "承認",
  REJECTED: "却下",
  RETURNED: "差し戻し",
};

export function useWorkflowApprovals() {
  const [activeTab, setActiveTab] = useState<WorkflowTab>("pending");
  const [workflowState, setWorkflowState] = useState<WorkflowLoadState>({
    snapshot: null,
    status: "loading",
    message: null,
    updatedAt: null,
  });
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<WorkflowFormState | null>(null);
  const [savingAction, setSavingAction] = useState<WorkflowSaveAction | null>(
    null,
  );

  const loadWorkflows = useCallback(async (signal?: AbortSignal) => {
    setWorkflowState((current) => ({
      ...current,
      status: current.snapshot ? "ready" : "loading",
      message: null,
    }));

    try {
      const response = await fetch("/api/workflows", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal,
      });
      const body = (await response.json()) as WorkflowsApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "申請データを取得できませんでした",
        );
      }

      setWorkflowState({
        snapshot: body.data,
        status: "ready",
        message: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setWorkflowState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "申請データを取得できませんでした",
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadWorkflows(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadWorkflows]);

  const pendingRequests = useMemo(
    () => workflowState.snapshot?.pendingRequests ?? [],
    [workflowState.snapshot?.pendingRequests],
  );
  const recentRequests = useMemo(
    () => workflowState.snapshot?.recentRequests ?? [],
    [workflowState.snapshot?.recentRequests],
  );
  const myRequests = useMemo(
    () => workflowState.snapshot?.myRequests ?? [],
    [workflowState.snapshot?.myRequests],
  );
  const visibleRequests =
    activeTab === "pending"
      ? pendingRequests
      : activeTab === "mine"
        ? myRequests
        : recentRequests;

  async function handleDecision(
    request: WorkflowRequestSummary,
    status: WorkflowDecisionInput["status"],
  ) {
    const label = decisionLabels[status];

    if (!window.confirm(`${request.title} を${label}しますか？`)) {
      return;
    }

    setDecidingId(request.id);
    setWorkflowState((current) => ({ ...current, message: null }));

    try {
      const response = await fetch(`/api/workflows/${request.id}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as WorkflowMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "申請を決裁できませんでした",
        );
      }

      if (activeTab === "pending") {
        setActiveTab("pending");
      }

      await loadWorkflows();
    } catch (error) {
      setWorkflowState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "申請を決裁できませんでした",
      }));
    } finally {
      setDecidingId(null);
    }
  }

  async function handleCreateRequest(action: WorkflowSaveAction) {
    if (!formState) {
      return;
    }

    setSavingAction(action);
    setWorkflowState((current) => ({ ...current, message: null }));

    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(workflowFormToInput(formState, action)),
      });
      const body = (await response.json()) as WorkflowMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "申請を保存できませんでした",
        );
      }

      setFormState(null);
      setActiveTab("mine");
      await loadWorkflows();
    } catch (error) {
      setWorkflowState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "申請を保存できませんでした",
      }));
    } finally {
      setSavingAction(null);
    }
  }

  function openCreateForm() {
    setFormState(
      createDefaultWorkflowFormState(
        workflowState.snapshot?.categories[0] ?? "その他",
      ),
    );
  }

  function closeForm() {
    setFormState(null);
  }

  function updateForm<Field extends keyof WorkflowFormState>(
    field: Field,
    value: WorkflowFormState[Field],
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
    activeTab,
    closeForm,
    decidingId,
    formState,
    handleCreateRequest,
    handleDecision,
    loadWorkflows,
    myRequests,
    openCreateForm,
    pendingRequests,
    recentRequests,
    savingAction,
    setActiveTab,
    updateForm,
    visibleRequests,
    workflowState,
  };
}
