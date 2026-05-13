import { ApplicationError } from "@/application/shared/application-error";
import type {
  CurrentUserContext,
  CurrentUserSession,
  MutationContext,
  PermissionCode,
  PermissionDescriptor,
} from "@/application/security/types";

export const permissionCatalog = [
  { code: "tenant.manage", name: "テナント設定を管理" },
  { code: "organization.manage", name: "組織・利用者を管理" },
  { code: "schedule.manage", name: "予定・施設予約を管理" },
  { code: "document.manage", name: "文書を管理" },
  { code: "document.read", name: "文書を閲覧" },
  { code: "workflow.approve", name: "申請を承認" },
] as const satisfies readonly PermissionDescriptor[];

export const permissions = {
  manageTenant: "tenant.manage",
  manageOrganization: "organization.manage",
  manageSchedule: "schedule.manage",
  manageDocuments: "document.manage",
  readDocuments: "document.read",
  approveWorkflow: "workflow.approve",
} as const;

export function assertPermission(
  currentUser: CurrentUserContext,
  permission: PermissionCode,
) {
  if (hasPermission(currentUser, permission)) {
    return;
  }

  throw new ApplicationError(
    "FORBIDDEN",
    "この操作を実行する権限がありません。",
    403,
  );
}

export function hasPermission(
  currentUser: CurrentUserContext,
  permission: PermissionCode,
) {
  return (
    currentUser.isSystemAdmin ||
    currentUser.permissionCodes.includes(permission)
  );
}

export function toMutationContext(
  currentUser: CurrentUserContext,
): MutationContext {
  return {
    tenantCode: currentUser.tenantCode,
    actorUserId: currentUser.userId,
  };
}

export function toCurrentUserSession(
  currentUser: CurrentUserContext,
): CurrentUserSession {
  return {
    tenant: {
      code: currentUser.tenantCode,
      name: currentUser.tenantName,
    },
    user: {
      id: currentUser.userId,
      email: currentUser.email,
      displayName: currentUser.displayName,
      isSystemAdmin: currentUser.isSystemAdmin,
      organizationUnitIds: currentUser.organizationUnitIds,
    },
    permissions: permissionCatalog.filter((permission) =>
      currentUser.permissionCodes.includes(permission.code),
    ),
    can: permissionCatalog.reduce(
      (result, permission) => ({
        ...result,
        [permission.code]: hasPermission(currentUser, permission.code),
      }),
      {} as Record<PermissionCode, boolean>,
    ),
  };
}

