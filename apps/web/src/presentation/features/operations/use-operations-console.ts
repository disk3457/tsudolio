"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  OperationsApiResponse,
  OperationsLoadState,
} from "@/application/operations/types";
import {
  defaultTenantProfileForm,
  tenantProfileFormToInput,
  tenantProfileToFormState,
  type TenantProfileFormState,
} from "@/presentation/features/operations/form-state";

export function useOperationsConsole() {
  const [operationsState, setOperationsState] =
    useState<OperationsLoadState>({
      snapshot: null,
      status: "loading",
      message: null,
      updatedAt: null,
    });
  const [tenantForm, setTenantForm] = useState<TenantProfileFormState>(
    defaultTenantProfileForm,
  );

  const loadOperations = useCallback(async (signal?: AbortSignal) => {
    setOperationsState((current) => ({
      ...current,
      status: current.snapshot ? "ready" : "loading",
      message: null,
    }));

    try {
      const response = await fetch("/api/operations", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal,
      });
      const body = (await response.json()) as OperationsApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "運用管理データを取得できませんでした。",
        );
      }

      setOperationsState({
        snapshot: body.data,
        status: "ready",
        message: null,
        updatedAt: new Date().toISOString(),
      });
      setTenantForm(tenantProfileToFormState(body.data.tenant));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setOperationsState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "運用管理データを取得できませんでした。",
      }));
    }
  }, []);

  const saveTenantProfile = useCallback(async () => {
    setOperationsState((current) => ({
      ...current,
      status: "saving",
      message: null,
    }));

    try {
      const response = await fetch("/api/operations", {
        body: JSON.stringify(tenantProfileFormToInput(tenantForm)),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const body = (await response.json()) as OperationsApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "テナント設定を保存できませんでした。",
        );
      }

      setOperationsState({
        snapshot: body.data,
        status: "ready",
        message: "テナント設定を保存しました。",
        updatedAt: new Date().toISOString(),
      });
      setTenantForm(tenantProfileToFormState(body.data.tenant));
    } catch (error) {
      setOperationsState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "テナント設定を保存できませんでした。",
      }));
    }
  }, [tenantForm]);

  function updateTenantForm<Field extends keyof TenantProfileFormState>(
    field: Field,
    value: TenantProfileFormState[Field],
  ) {
    setTenantForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  useEffect(() => {
    const controller = new AbortController();

    void loadOperations(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadOperations]);

  return {
    exportPath: operationsState.snapshot?.backup.endpoint ?? "/api/operations/export",
    loadOperations,
    operationsState,
    saveTenantProfile,
    tenantForm,
    updateTenantForm,
  };
}
