import { privilegedAuthenticationPermissionCodes } from "@/application/security/permissions";

export const backupEndpoint = "/api/operations/export";

export const privilegedPermissionCodes = [
  ...privilegedAuthenticationPermissionCodes,
];

export const backupIncludes = [
  "テナント設定",
  "組織・利用者・権限",
  "予定・施設予約",
  "掲示・回覧",
  "申請・承認",
  "文書台帳・版履歴",
];
