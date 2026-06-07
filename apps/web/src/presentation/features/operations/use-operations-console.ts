"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  OperationsApiResponse,
  OperationsImportValidationApiResponse,
  OperationsImportValidationReport,
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
  const [importValidationState, setImportValidationState] =
    useState<OperationImportValidationState>({
      fileName: null,
      message: null,
      report: null,
      status: "idle",
    });

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

  const validateImportFile = useCallback(
    async (file: File) => {
      setImportValidationState({
        fileName: file.name,
        message: null,
        report: null,
        status: "validating",
      });

      try {
        const text = await file.text();
        let payload: unknown;

        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error("JSONファイルの形式が正しくありません。");
        }

        const response = await fetch("/api/operations/import", {
          body: JSON.stringify(payload),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const body =
          (await response.json()) as OperationsImportValidationApiResponse;

        if (!response.ok || !("data" in body)) {
          throw new Error(
            "message" in body
              ? body.message
              : "運用エクスポートJSONを検査できませんでした。",
          );
        }

        setImportValidationState({
          fileName: file.name,
          message: getImportValidationMessage(body.data.status),
          report: body.data,
          status: "ready",
        });
        void loadOperations();
      } catch (error) {
        setImportValidationState((current) => ({
          ...current,
          message:
            error instanceof Error
              ? error.message
              : "運用エクスポートJSONを検査できませんでした。",
          report: null,
          status: "error",
        }));
      }
    },
    [loadOperations],
  );

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
    importValidationState,
    loadOperations,
    operationsState,
    saveTenantProfile,
    tenantForm,
    updateTenantForm,
    validateImportFile,
  };
}

type OperationImportValidationState = {
  fileName: string | null;
  message: string | null;
  report: OperationsImportValidationReport | null;
  status: "idle" | "validating" | "ready" | "error";
};

function getImportValidationMessage(
  status: OperationsImportValidationReport["status"],
) {
  if (status === "READY") {
    return "復元前チェックは完了しました。";
  }

  if (status === "WARNING") {
    return "復元前チェックは完了しました。注意事項を確認してください。";
  }

  return "復元前チェックでブロック項目が見つかりました。";
}
