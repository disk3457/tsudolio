export type PermissionCode =
  | "tenant.manage"
  | "organization.manage"
  | "schedule.manage"
  | "document.manage"
  | "document.read"
  | "workflow.approve";

export type PermissionDescriptor = {
  code: PermissionCode;
  name: string;
};

export type CurrentUserContext = {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  userId: string;
  email: string;
  displayName: string;
  isSystemAdmin: boolean;
  passwordLoginEnabled: boolean;
  organizationUnitIds: string[];
  permissionCodes: string[];
};

export type MutationContext = {
  tenantCode: string;
  actorUserId: string;
  ipAddress?: string | null;
};

export type CurrentUserLookup = {
  tenantCode: string;
  userEmail: string;
};

export type CurrentUserSession = {
  tenant: {
    code: string;
    name: string;
  };
  user: {
    id: string;
    email: string;
    displayName: string;
    isSystemAdmin: boolean;
    passwordLoginEnabled: boolean;
    organizationUnitIds: string[];
  };
  permissions: PermissionDescriptor[];
  can: Record<PermissionCode, boolean>;
};

export type PasswordChangeApiResponse =
  | {
      data: {
        changed: boolean;
        passwordChangedAt: string;
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type PasswordResetRequestApiResponse =
  | {
      data: {
        accepted: boolean;
        emailDelivery?: "sent" | "skipped";
        expiresAt?: string;
        resetUrl?: string;
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type PasswordResetConfirmApiResponse =
  | {
      data: {
        changed: boolean;
        passwordChangedAt: string;
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type PasskeySummary = {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

export type PasskeyListApiResponse =
  | {
      data: {
        passkeys: PasskeySummary[];
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type PasskeyRegistrationOptionsApiResponse =
  | {
      data: {
        options: unknown;
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type PasskeyRegistrationVerifyApiResponse =
  | {
      data: {
        passkey: PasskeySummary;
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type PasskeyDeleteApiResponse =
  | {
      data: {
        deleted: boolean;
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type CurrentUserApiResponse =
  | {
      data: CurrentUserSession;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type SessionLoadState = {
  session: CurrentUserSession | null;
  status: "loading" | "ready" | "error";
  message: string | null;
};
