"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AuditLogRetentionDays,
  AuditRetentionApiResponse,
  AuditRetentionLoadState,
} from "@/application/audit/types";
import { usePasskeyStepUp } from "@/presentation/features/auth/use-passkey-step-up";

export function useAuditRetention() {
  const { fetchJsonWithStepUp, stepUpState } = usePasskeyStepUp();
  const [auditRetentionState, setAuditRetentionState] =
    useState<AuditRetentionLoadState>({
      snapshot: null,
      status: "loading",
      message: null,
      updatedAt: null,
    });

  const loadAuditRetention = useCallback(async (signal?: AbortSignal) => {
    setAuditRetentionState((current) => ({
      ...current,
      status: current.snapshot ? "ready" : "loading",
      message: null,
    }));

    try {
      const response = await fetch("/api/security/audit-retention", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal,
      });
      const body = (await response.json()) as AuditRetentionApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body
            ? body.message
            : "監査ログ保持設定を取得できませんでした。",
        );
      }

      setAuditRetentionState({
        snapshot: body.data,
        status: "ready",
        message: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setAuditRetentionState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "監査ログ保持設定を取得できませんでした。",
      }));
    }
  }, []);

  const updateAuditRetentionPolicy = useCallback(
    async (retentionDays: AuditLogRetentionDays) => {
      setAuditRetentionState((current) => ({
        ...current,
        status: "saving",
        message: null,
      }));

      try {
        const { body, response } =
          await fetchJsonWithStepUp<AuditRetentionApiResponse>(
            "/api/security/audit-retention",
            {
              body: JSON.stringify({
                retentionDays,
              }),
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              method: "PUT",
            },
          );

        if (!response.ok || !("data" in body)) {
          throw new Error(
            "message" in body
              ? body.message
              : "監査ログ保持設定を更新できませんでした。",
          );
        }

        setAuditRetentionState({
          snapshot: body.data,
          status: "ready",
          message: "監査ログ保持設定を更新しました。",
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        setAuditRetentionState((current) => ({
          ...current,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "監査ログ保持設定を更新できませんでした。",
        }));
      }
    },
    [fetchJsonWithStepUp],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadAuditRetention(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadAuditRetention]);

  return {
    auditRetentionState,
    loadAuditRetention,
    stepUpState,
    updateAuditRetentionPolicy,
  };
}
