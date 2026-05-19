"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AuthPolicyApiResponse,
  AuthPolicyLoadState,
} from "@/application/security/types";

export function useAuthPolicy() {
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
        const response = await fetch("/api/security/auth-policy", {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requirePasskeyForPrivilegedUsers,
          }),
        });
        const body = (await response.json()) as AuthPolicyApiResponse;

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
    [],
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
    updateAuthPolicy,
  };
}
