"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AuthPolicyApiResponse,
  AuthPolicyLoadState,
} from "@/application/security/types";
import { usePasskeyStepUp } from "@/presentation/features/auth/use-passkey-step-up";

export function useAuthPolicy() {
  const { fetchJsonWithStepUp, stepUpState } = usePasskeyStepUp();
  const [authPolicyState, setAuthPolicyState] =
    useState<AuthPolicyLoadState>({
      snapshot: null,
      status: "loading",
      message: null,
      updatedAt: null,
    });

  const loadAuthPolicy = useCallback(async (signal?: AbortSignal) => {
    setAuthPolicyState((current) => ({
      ...current,
      status: current.snapshot ? "ready" : "loading",
      message: null,
    }));

    try {
      const response = await fetch("/api/security/auth-policy", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal,
      });
      const body = (await response.json()) as AuthPolicyApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body
            ? body.message
            : "認証ポリシーを取得できませんでした。",
        );
      }

      setAuthPolicyState({
        snapshot: body.data,
        status: "ready",
        message: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setAuthPolicyState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "認証ポリシーを取得できませんでした。",
      }));
    }
  }, []);

  const updateAuthPolicy = useCallback(
    async (requirePasskeyForPrivilegedUsers: boolean) => {
      setAuthPolicyState((current) => ({
        ...current,
        status: "saving",
        message: null,
      }));

      try {
        const { body, response } =
          await fetchJsonWithStepUp<AuthPolicyApiResponse>(
            "/api/security/auth-policy",
            {
              method: "PUT",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                requirePasskeyForPrivilegedUsers,
              }),
            },
          );

        if (!response.ok || !("data" in body)) {
          throw new Error(
            "message" in body
              ? body.message
              : "認証ポリシーを更新できませんでした。",
          );
        }

        setAuthPolicyState({
          snapshot: body.data,
          status: "ready",
          message: "認証ポリシーを更新しました。",
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        setAuthPolicyState((current) => ({
          ...current,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "認証ポリシーを更新できませんでした。",
        }));
      }
    },
    [fetchJsonWithStepUp],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadAuthPolicy(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadAuthPolicy]);

  return {
    authPolicyState,
    loadAuthPolicy,
    stepUpState,
    updateAuthPolicy,
  };
}
