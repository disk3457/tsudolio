import { Fingerprint } from "lucide-react";
import type { PasskeyStepUpState } from "@/presentation/features/auth/use-passkey-step-up";

export function SettingsStepUpNotice({
  stepUpState,
}: {
  stepUpState: PasskeyStepUpState;
}) {
  if (!stepUpState.message) {
    return null;
  }

  return (
    <div
      className={`settingsStepUpNotice ${
        stepUpState.status === "error" ? "error" : "success"
      }`}
      role={stepUpState.status === "error" ? "alert" : "status"}
    >
      <Fingerprint aria-hidden="true" size={17} />
      <span>{stepUpState.message}</span>
    </div>
  );
}
