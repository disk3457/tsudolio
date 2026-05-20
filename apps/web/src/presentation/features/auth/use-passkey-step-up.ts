"use client";

import { useCallback, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import type {
  PasskeyStepUpOptionsApiResponse,
  PasskeyStepUpVerifyApiResponse,
} from "@/application/security/types";
import { useWebAuthnSupport } from "@/presentation/features/auth/use-webauthn-support";

type AuthenticationOptionsJSON = Parameters<
  typeof startAuthentication
>[0]["optionsJSON"];

type ApiErrorBody = {
  error?: string;
  message?: string;
};

type FetchJsonResult<T> = {
  body: T;
  response: Response;
};

export type PasskeyStepUpState = {
  status: "idle" | "verifying" | "success" | "error";
  message: string | null;
};

const idleStepUpState: PasskeyStepUpState = {
  status: "idle",
  message: null,
};

export function usePasskeyStepUp() {
  const webAuthnSupported = useWebAuthnSupport();
  const [stepUpState, setStepUpState] =
    useState<PasskeyStepUpState>(idleStepUpState);

  const verifyWithPasskey = useCallback(async () => {
    if (!webAuthnSupported) {
      throw new Error("このブラウザではPasskeyを利用できません。");
    }

    setStepUpState({
      status: "verifying",
      message: "Passkeyで本人確認してください。",
    });

    const optionsResponse = await fetch("/api/auth/step-up/passkey/options", {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      method: "POST",
    });
    const optionsBody =
      (await optionsResponse.json()) as PasskeyStepUpOptionsApiResponse;

    if (!optionsResponse.ok || !("data" in optionsBody)) {
      throw new Error(
        "message" in optionsBody
          ? optionsBody.message
          : "Passkey本人確認を開始できませんでした。",
      );
    }

    const authenticationResponse = await startAuthentication({
      optionsJSON: optionsBody.data.options as AuthenticationOptionsJSON,
    });
    const verifyResponse = await fetch("/api/auth/step-up/passkey/verify", {
      body: JSON.stringify({
        response: authenticationResponse,
      }),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const verifyBody =
      (await verifyResponse.json()) as PasskeyStepUpVerifyApiResponse;

    if (!verifyResponse.ok || !("data" in verifyBody)) {
      throw new Error(
        "message" in verifyBody
          ? verifyBody.message
          : "Passkey本人確認を完了できませんでした。",
      );
    }

    setStepUpState({
      status: "success",
      message: "本人確認しました。",
    });
  }, [webAuthnSupported]);

  const fetchJsonWithStepUp = useCallback(
    async <T>(
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<FetchJsonResult<T>> => {
      const firstResult = await fetchJson<T>(input, init);

      if (!isStepUpRequired(firstResult)) {
        return firstResult;
      }

      try {
        await verifyWithPasskey();
        return await fetchJson<T>(input, init);
      } catch (error) {
        setStepUpState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Passkey本人確認を完了できませんでした。",
        });
        throw error;
      }
    },
    [verifyWithPasskey],
  );

  return {
    fetchJsonWithStepUp,
    stepUpState,
  };
}

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<FetchJsonResult<T>> {
  const response = await fetch(input, init);
  const body = (await response.json()) as T;

  return {
    body,
    response,
  };
}

function isStepUpRequired<T>({ body, response }: FetchJsonResult<T>) {
  if (response.status !== 428 || !isRecord(body)) {
    return false;
  }

  const errorBody = body as ApiErrorBody;

  return errorBody.error === "STEP_UP_REQUIRED";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
