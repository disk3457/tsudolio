"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/browser";
import type {
  CurrentUserSession,
  PasskeyDeleteApiResponse,
  PasskeyListApiResponse,
  PasskeyRegistrationOptionsApiResponse,
  PasskeyRegistrationVerifyApiResponse,
  PasskeySummary,
  PasskeyUpdateApiResponse,
  PasswordChangeApiResponse,
  RecoveryCodeGenerateApiResponse,
  RecoveryCodeListApiResponse,
  RecoveryCodeSummary,
} from "@/application/security/types";
import { usePasskeyStepUp } from "@/presentation/features/auth/use-passkey-step-up";
import { useWebAuthnSupport } from "@/presentation/features/auth/use-webauthn-support";
import { PasskeySettingsCard } from "@/presentation/features/settings/components/passkey-settings-card";
import { PasswordSettingsCard } from "@/presentation/features/settings/components/password-settings-card";
import { RecoveryCodeSettingsCard } from "@/presentation/features/settings/components/recovery-code-settings-card";
import { SettingsSecondaryCards } from "@/presentation/features/settings/components/settings-secondary-cards";
import { SettingsStepUpNotice } from "@/presentation/features/settings/components/settings-step-up-notice";
import {
  defaultPasswordForm,
  type PasskeySaveState,
  type PasswordFormState,
  type PasswordSaveState,
  type RecoveryCodeSaveState,
} from "@/presentation/features/settings/settings-types";

export function SettingsView({
  session,
}: {
  session: CurrentUserSession | null;
}) {
  const [passwordForm, setPasswordForm] =
    useState<PasswordFormState>(defaultPasswordForm);
  const [passwordState, setPasswordState] = useState<PasswordSaveState>({
    status: "idle",
    message: null,
  });
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [passkeyName, setPasskeyName] = useState("");
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
  const [editingPasskeyName, setEditingPasskeyName] = useState("");
  const [recoveryCodes, setRecoveryCodes] =
    useState<RecoveryCodeSummary | null>(null);
  const [generatedRecoveryCodes, setGeneratedRecoveryCodes] = useState<
    string[]
  >([]);
  const webAuthnSupported = useWebAuthnSupport();
  const { fetchJsonWithStepUp, stepUpState } = usePasskeyStepUp();
  const [passkeyState, setPasskeyState] = useState<PasskeySaveState>({
    status: "idle",
    message: null,
  });
  const [recoveryCodeState, setRecoveryCodeState] =
    useState<RecoveryCodeSaveState>({
      status: "idle",
      message: null,
    });
  const passwordLoginEnabled = Boolean(session?.user.passwordLoginEnabled);
  const passwordFormDisabled =
    !passwordLoginEnabled || passwordState.status === "saving";
  const passkeyBusy =
    passkeyState.status === "loading" ||
    passkeyState.status === "registering" ||
    passkeyState.status === "renaming" ||
    passkeyState.status === "deleting" ||
    stepUpState.status === "verifying";
  const passkeysLoaded = passkeyState.status !== "loading";
  const passkeyRegistrationDisabled =
    !session || !webAuthnSupported || passkeyBusy;
  const recoveryCodeBusy =
    recoveryCodeState.status === "loading" ||
    recoveryCodeState.status === "generating" ||
    stepUpState.status === "verifying";
  const recoveryCodeGenerateDisabled =
    !session || !passkeysLoaded || passkeys.length === 0 || recoveryCodeBusy;

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    async function loadPasskeys() {
      setPasskeyState({
        status: "loading",
        message: null,
      });

      try {
        const response = await fetch("/api/auth/passkeys", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });
        const body = (await response.json()) as PasskeyListApiResponse;

        if (!response.ok || !("data" in body)) {
          throw new Error(
            "message" in body
              ? body.message
              : "Passkey情報を取得できませんでした。",
          );
        }

        if (!cancelled) {
          setPasskeys(body.data.passkeys);
          setPasskeyState({
            status: "idle",
            message: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setPasskeyState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Passkey情報を取得できませんでした。",
          });
        }
      }
    }

    async function loadRecoveryCodes() {
      setRecoveryCodeState({
        status: "loading",
        message: null,
      });

      try {
        const response = await fetch("/api/auth/recovery-codes", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });
        const body = (await response.json()) as RecoveryCodeListApiResponse;

        if (!response.ok || !("data" in body)) {
          throw new Error(
            "message" in body
              ? body.message
              : "リカバリーコード情報を取得できませんでした。",
          );
        }

        if (!cancelled) {
          setRecoveryCodes(body.data.recoveryCodes);
          setRecoveryCodeState({
            status: "idle",
            message: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRecoveryCodeState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "リカバリーコード情報を取得できませんでした。",
          });
        }
      }
    }

    void loadPasskeys();
    void loadRecoveryCodes();

    return () => {
      cancelled = true;
    };
  }, [session]);

  function updatePasswordField<Field extends keyof PasswordFormState>(
    field: Field,
    value: PasswordFormState[Field],
  ) {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordState({
        status: "error",
        message: "新しいパスワードと確認入力が一致しません。",
      });
      return;
    }

    setPasswordState({
      status: "saving",
      message: null,
    });

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const body = (await response.json()) as PasswordChangeApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "パスワードを変更できませんでした",
        );
      }

      setPasswordForm(defaultPasswordForm);
      setPasswordState({
        status: "success",
        message: "パスワードを変更しました。",
      });
    } catch (error) {
      setPasswordState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "パスワードを変更できませんでした",
      });
    }
  }

  async function registerPasskey() {
    if (!webAuthnSupported) {
      setPasskeyState({
        status: "error",
        message: "このブラウザではPasskeyを利用できません。",
      });
      return;
    }

    setPasskeyState({
      status: "registering",
      message: null,
    });

    try {
      const optionsResponse = await fetch(
        "/api/auth/passkeys/register/options",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: passkeyName,
          }),
        },
      );
      const optionsBody =
        (await optionsResponse.json()) as PasskeyRegistrationOptionsApiResponse;

      if (!optionsResponse.ok || !("data" in optionsBody)) {
        throw new Error(
          "message" in optionsBody
            ? optionsBody.message
            : "Passkey登録を開始できませんでした。",
        );
      }

      const registrationResponse = await startRegistration({
        optionsJSON:
          optionsBody.data.options as PublicKeyCredentialCreationOptionsJSON,
      });
      const verifyResponse = await fetch(
        "/api/auth/passkeys/register/verify",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: passkeyName,
            response: registrationResponse,
          }),
        },
      );
      const verifyBody =
        (await verifyResponse.json()) as PasskeyRegistrationVerifyApiResponse;

      if (!verifyResponse.ok || !("data" in verifyBody)) {
        throw new Error(
          "message" in verifyBody
            ? verifyBody.message
            : "Passkey登録を完了できませんでした。",
        );
      }

      setPasskeyName("");
      setPasskeys((current) => [verifyBody.data.passkey, ...current]);
      setPasskeyState({
        status: "success",
        message: "Passkeyを登録しました。",
      });
    } catch (error) {
      setPasskeyState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Passkey登録を完了できませんでした。",
      });
    }
  }

  function startPasskeyRename(passkey: PasskeySummary) {
    setEditingPasskeyId(passkey.id);
    setEditingPasskeyName(passkey.name);
    setPasskeyState({
      status: "idle",
      message: null,
    });
  }

  function cancelPasskeyRename() {
    setEditingPasskeyId(null);
    setEditingPasskeyName("");
  }

  async function renamePasskey(passkey: PasskeySummary) {
    const nextName = editingPasskeyName.trim();

    if (!nextName) {
      setPasskeyState({
        status: "error",
        message: "Passkey名を入力してください。",
      });
      return;
    }

    if (nextName === passkey.name) {
      cancelPasskeyRename();
      return;
    }

    setPasskeyState({
      status: "renaming",
      message: null,
    });

    try {
      const { body, response } =
        await fetchJsonWithStepUp<PasskeyUpdateApiResponse>(
          `/api/auth/passkeys/${passkey.id}`,
          {
            method: "PATCH",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: nextName,
            }),
          },
        );

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "Passkeyを更新できませんでした。",
        );
      }

      setPasskeys((current) =>
        current.map((currentPasskey) =>
          currentPasskey.id === body.data.passkey.id
            ? body.data.passkey
            : currentPasskey,
        ),
      );
      cancelPasskeyRename();
      setPasskeyState({
        status: "success",
        message: "Passkey名を更新しました。",
      });
    } catch (error) {
      setPasskeyState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Passkeyを更新できませんでした。",
      });
    }
  }

  async function deletePasskey(passkey: PasskeySummary) {
    setPasskeyState({
      status: "deleting",
      message: null,
    });

    try {
      const { body, response } =
        await fetchJsonWithStepUp<PasskeyDeleteApiResponse>(
          `/api/auth/passkeys/${passkey.id}`,
          {
            method: "DELETE",
            headers: {
              Accept: "application/json",
            },
          },
        );

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "Passkeyを削除できませんでした。",
        );
      }

      setPasskeys((current) =>
        current.filter((currentPasskey) => currentPasskey.id !== passkey.id),
      );
      setPasskeyState({
        status: "success",
        message: "Passkeyを削除しました。",
      });
    } catch (error) {
      setPasskeyState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Passkeyを削除できませんでした。",
      });
    }
  }

  async function generateRecoveryCodes() {
    setRecoveryCodeState({
      status: "generating",
      message: null,
    });
    setGeneratedRecoveryCodes([]);

    try {
      const { body, response } =
        await fetchJsonWithStepUp<RecoveryCodeGenerateApiResponse>(
          "/api/auth/recovery-codes",
          {
            method: "POST",
            headers: {
              Accept: "application/json",
            },
          },
        );

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body
            ? body.message
            : "リカバリーコードを発行できませんでした。",
        );
      }

      setGeneratedRecoveryCodes(body.data.codes);
      setRecoveryCodes(body.data.recoveryCodes);
      setRecoveryCodeState({
        status: "success",
        message: "リカバリーコードを発行しました。",
      });
    } catch (error) {
      setRecoveryCodeState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "リカバリーコードを発行できませんでした。",
      });
    }
  }

  async function copyGeneratedRecoveryCodes() {
    if (generatedRecoveryCodes.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedRecoveryCodes.join("\n"));
      setRecoveryCodeState({
        status: "success",
        message: "リカバリーコードをコピーしました。",
      });
    } catch {
      setRecoveryCodeState({
        status: "error",
        message: "リカバリーコードをコピーできませんでした。",
      });
    }
  }

  return (
    <section className="settingsGrid" aria-label="共通設定">
      <SettingsStepUpNotice stepUpState={stepUpState} />
      <PasswordSettingsCard
        disabled={passwordFormDisabled}
        form={passwordForm}
        loginEnabled={passwordLoginEnabled}
        onSubmit={submitPasswordChange}
        onUpdateField={updatePasswordField}
        state={passwordState}
      />
      <PasskeySettingsCard
        busy={passkeyBusy}
        editingPasskeyId={editingPasskeyId}
        editingPasskeyName={editingPasskeyName}
        passkeyName={passkeyName}
        passkeys={passkeys}
        passkeysLoaded={passkeysLoaded}
        registrationDisabled={passkeyRegistrationDisabled}
        state={passkeyState}
        webAuthnSupported={webAuthnSupported}
        onCancelRename={cancelPasskeyRename}
        onDelete={(passkey) => void deletePasskey(passkey)}
        onEditingNameChange={setEditingPasskeyName}
        onRegister={() => void registerPasskey()}
        onRegistrationNameChange={setPasskeyName}
        onRename={(passkey) => void renamePasskey(passkey)}
        onStartRename={startPasskeyRename}
      />
      <RecoveryCodeSettingsCard
        generatedCodes={generatedRecoveryCodes}
        generateDisabled={recoveryCodeGenerateDisabled}
        passkeyRequired={passkeysLoaded && passkeys.length === 0}
        recoveryCodes={recoveryCodes}
        state={recoveryCodeState}
        onCopy={() => void copyGeneratedRecoveryCodes()}
        onGenerate={() => void generateRecoveryCodes()}
      />
      <SettingsSecondaryCards />
    </section>
  );
}
