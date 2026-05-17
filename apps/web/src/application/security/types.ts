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
