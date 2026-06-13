"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  OperationsApiResponse,
  OperationsImportValidationApiResponse,
  OperationsImportValidationReport,
  OperationsLoadState,
  OperationsRestoreDryRunApiResponse,
  OperationsRestoreDryRunReport,
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
      payload: null,
      report: null,
      status: "idle",
    });
  const [restoreDryRunState, setRestoreDryRunState] =
    useState<OperationRestoreDryRunState>({
      confirmationToken: "",
      currentBackupFileName: null,
      currentBackupPayload: null,
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
        payload: null,
        report: null,
        status: "validating",
      });
      setRestoreDryRunState((current) => ({
        ...current,
        message: null,
        report: null,
        status: current.currentBackupPayload ? "ready" : "idle",
      }));

      try {
        const payload = await readJsonFile(file);

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
          payload,
          report: body.data,
          status: "ready",
        });
        setRestoreDryRunState((current) => ({
          ...current,
          confirmationToken: "",
          message: current.currentBackupPayload
            ? "ドライランを実行できます。"
            : "現行バックアップJSONを選択してください。",
          report: null,
          status: current.currentBackupPayload ? "ready" : "idle",
        }));
        void loadOperations();
      } catch (error) {
        setImportValidationState((current) => ({
          ...current,
          message:
            error instanceof Error
              ? error.message
              : "運用エクスポートJSONを検査できませんでした。",
          payload: null,
          report: null,
          status: "error",
        }));
        setRestoreDryRunState((current) => ({
          ...current,
          message: null,
          report: null,
          status: "idle",
        }));
      }
    },
    [loadOperations],
  );

  const selectCurrentBackupFile = useCallback(async (file: File) => {
    setRestoreDryRunState((current) => ({
      ...current,
      currentBackupFileName: file.name,
      currentBackupPayload: null,
      message: null,
      report: null,
      status: "running",
    }));

    try {
      const payload = await readJsonFile(file);

      setRestoreDryRunState((current) => ({
        ...current,
        currentBackupFileName: file.name,
        currentBackupPayload: payload,
        message: "現行バックアップJSONを読み込みました。",
        report: null,
        status: importValidationState.payload ? "ready" : "idle",
      }));
    } catch (error) {
      setRestoreDryRunState((current) => ({
        ...current,
        currentBackupPayload: null,
        message:
          error instanceof Error
            ? error.message
            : "現行バックアップJSONを読み込めませんでした。",
        report: null,
        status: "error",
      }));
    }
  }, [importValidationState.payload]);

  const updateRestoreConfirmationToken = useCallback((value: string) => {
    setRestoreDryRunState((current) => ({
      ...current,
      confirmationToken: value,
      message: null,
      report: null,
      status:
        current.currentBackupPayload && importValidationState.payload
          ? "ready"
          : current.status === "error"
            ? "error"
            : "idle",
    }));
  }, [importValidationState.payload]);

  const runRestoreDryRun = useCallback(async () => {
    if (!importValidationState.payload) {
      setRestoreDryRunState((current) => ({
        ...current,
        message: "復元対象JSONを選択してください。",
        report: null,
        status: "error",
      }));
      return;
    }

    if (!restoreDryRunState.currentBackupPayload) {
      setRestoreDryRunState((current) => ({
        ...current,
        message: "現行バックアップJSONを選択してください。",
        report: null,
        status: "error",
      }));
      return;
    }

    setRestoreDryRunState((current) => ({
      ...current,
      message: null,
      report: null,
      status: "running",
    }));

    try {
      const response = await fetch("/api/operations/restore", {
        body: JSON.stringify({
          backup: importValidationState.payload,
          confirmationToken: restoreDryRunState.confirmationToken.trim(),
          currentBackup: restoreDryRunState.currentBackupPayload,
          mode: "DRY_RUN",
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body =
        (await response.json()) as OperationsRestoreDryRunApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body
            ? body.message
            : "復元ドライランを実行できませんでした。",
        );
      }

      setRestoreDryRunState((current) => ({
        ...current,
        message: body.data.canProceed
          ? "復元ドライランは完了しました。"
          : "復元ドライランで停止条件が見つかりました。",
        report: body.data,
        status: "success",
      }));
      void loadOperations();
    } catch (error) {
      setRestoreDryRunState((current) => ({
        ...current,
        message:
          error instanceof Error
            ? error.message
            : "復元ドライランを実行できませんでした。",
        report: null,
        status: "error",
      }));
    }
  }, [
    importValidationState.payload,
    loadOperations,
    restoreDryRunState.confirmationToken,
    restoreDryRunState.currentBackupPayload,
  ]);

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
    restoreDryRunState,
    runRestoreDryRun,
    saveTenantProfile,
    selectCurrentBackupFile,
    tenantForm,
    updateTenantForm,
    updateRestoreConfirmationToken,
    validateImportFile,
  };
}

type OperationImportValidationState = {
  fileName: string | null;
  message: string | null;
  payload: unknown | null;
  report: OperationsImportValidationReport | null;
  status: "idle" | "validating" | "ready" | "error";
};

type OperationRestoreDryRunState = {
  confirmationToken: string;
  currentBackupFileName: string | null;
  currentBackupPayload: unknown | null;
  message: string | null;
  report: OperationsRestoreDryRunReport | null;
  status: "idle" | "ready" | "running" | "success" | "error";
};

async function readJsonFile(file: File) {
  const text = await file.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("JSONファイルの形式が正しくありません。");
  }
}

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
