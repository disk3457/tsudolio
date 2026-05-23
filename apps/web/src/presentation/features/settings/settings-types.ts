export type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type PasswordSaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string | null;
};

export type PasskeySaveState = {
  status:
    | "idle"
    | "loading"
    | "registering"
    | "renaming"
    | "deleting"
    | "success"
    | "error";
  message: string | null;
};

export type RecoveryCodeSaveState = {
  status: "idle" | "loading" | "generating" | "success" | "error";
  message: string | null;
};

export const defaultPasswordForm: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};
