import type {
  OperationHardeningChecklist,
  OperationHardeningItem,
  OperationHardeningStatus,
} from "@/application/operations/types";

export function buildHardeningChecklist(input: {
  backupRecordCount: number;
  checkedAt: string;
  criticalSecurityEventCount: number;
  passkeyCredentialCount: number;
  privilegedUserCount: number;
  privilegedUsersWithPasskeyCount: number;
  requirePasskeyForPrivilegedUsers: boolean;
  retentionDays: number;
  systemAdminCount: number;
  warningSecurityEventCount: number;
}): OperationHardeningChecklist {
  const sessionSecretStatus = getSessionSecretStatus();
  const mailStatus = getMailDeliveryStatus();
  const oidcStatus = getOidcProviderStatus();
  const missingPrivilegedPasskeys =
    input.privilegedUserCount - input.privilegedUsersWithPasskeyCount;
  const items: OperationHardeningItem[] = [
    {
      key: "session-secret",
      label: "セッション秘密値",
      status: sessionSecretStatus,
      detail:
        sessionSecretStatus === "OK"
          ? "署名済みセッションCookieの秘密値は運用可能な長さです。"
          : "AUTH_SESSION_SECRETを32文字以上のランダム値に更新してください。",
      evidence:
        sessionSecretStatus === "OK"
          ? "32文字以上の値を検出"
          : "未設定またはサンプル値",
    },
    {
      key: "admin-accounts",
      label: "管理者アカウント",
      status:
        input.systemAdminCount === 0
          ? "ACTION_REQUIRED"
          : input.systemAdminCount > 3
            ? "ATTENTION"
            : "OK",
      detail:
        input.systemAdminCount === 0
          ? "緊急時の管理者アカウントを少なくとも1件用意してください。"
          : input.systemAdminCount > 3
            ? "システム管理者が多めです。権限棚卸しを確認してください。"
            : "システム管理者の人数は最小構成です。",
      evidence: `${input.systemAdminCount}人`,
    },
    {
      key: "privileged-passkey-policy",
      label: "高権限Passkey必須",
      status: input.requirePasskeyForPrivilegedUsers
        ? "OK"
        : "ACTION_REQUIRED",
      detail: input.requirePasskeyForPrivilegedUsers
        ? "高権限利用者はPasskeyまたは回復コードでの認証に制限されています。"
        : "高権限利用者にPasskey必須ポリシーを適用してください。",
      evidence: input.requirePasskeyForPrivilegedUsers ? "有効" : "無効",
    },
    {
      key: "privileged-passkey-coverage",
      label: "高権限Passkey登録",
      status:
        input.privilegedUserCount === 0 || missingPrivilegedPasskeys > 0
          ? input.privilegedUsersWithPasskeyCount === 0
            ? "ACTION_REQUIRED"
            : "ATTENTION"
          : "OK",
      detail:
        input.privilegedUserCount === 0
          ? "高権限利用者が見つかりません。管理者設定を確認してください。"
          : missingPrivilegedPasskeys > 0
            ? "高権限利用者の一部にPasskey登録がありません。"
            : "高権限利用者は全員Passkeyを登録済みです。",
      evidence: `${input.privilegedUsersWithPasskeyCount}/${input.privilegedUserCount}人 / 全体${input.passkeyCredentialCount}件`,
    },
    {
      key: "audit-retention",
      label: "監査ログ保持",
      status:
        input.retentionDays >= 365
          ? "OK"
          : input.retentionDays >= 180
            ? "ATTENTION"
            : "ACTION_REQUIRED",
      detail:
        input.retentionDays >= 365
          ? "監査ログ保持期間はMVP基準を満たしています。"
          : "監査ログ保持期間を365日以上に設定してください。",
      evidence: `${input.retentionDays}日`,
    },
    {
      key: "backup-export",
      label: "バックアップエクスポート",
      status: input.backupRecordCount > 0 ? "OK" : "ACTION_REQUIRED",
      detail:
        input.backupRecordCount > 0
          ? "運用エクスポート対象データを検出しています。"
          : "復元前チェックに使える運用エクスポート対象がありません。",
      evidence: `${input.backupRecordCount}レコード`,
    },
    {
      key: "password-reset-mail",
      label: "パスワードリセット配送",
      status: mailStatus,
      detail:
        mailStatus === "OK"
          ? "MAIL_FROMとSMTPホストが設定されています。"
          : "パスワードリセットメール配送の環境変数を設定してください。",
      evidence: mailStatus === "OK" ? "SMTP設定あり" : "SMTP設定不足",
    },
    {
      key: "oidc-provider",
      label: "OIDCプロバイダー",
      status: oidcStatus,
      detail:
        oidcStatus === "OK"
          ? "OIDCログインに必要な主要設定があります。"
          : "本番運用前にOIDC_ISSUER_URLとクライアント設定を確認してください。",
      evidence: oidcStatus === "OK" ? "設定あり" : "未設定",
    },
    {
      key: "security-events",
      label: "直近重大イベント",
      status:
        input.criticalSecurityEventCount > 0
          ? "ACTION_REQUIRED"
          : input.warningSecurityEventCount > 0
            ? "ATTENTION"
            : "OK",
      detail:
        input.criticalSecurityEventCount > 0
          ? "直近24時間にCRITICAL監査イベントがあります。"
          : input.warningSecurityEventCount > 0
            ? "直近24時間にWARNING監査イベントがあります。"
            : "直近24時間に警告以上の監査イベントはありません。",
      evidence: `CRITICAL ${input.criticalSecurityEventCount}件 / WARNING ${input.warningSecurityEventCount}件`,
    },
  ];
  const completedCount = items.filter((item) => item.status === "OK").length;
  const attentionCount = items.filter(
    (item) => item.status === "ATTENTION",
  ).length;
  const actionRequiredCount = items.filter(
    (item) => item.status === "ACTION_REQUIRED",
  ).length;

  return {
    actionRequiredCount,
    attentionCount,
    completedCount,
    generatedAt: input.checkedAt,
    items,
    score: Math.round((completedCount / items.length) * 100),
    status: getAggregateHardeningStatus(items),
    totalCount: items.length,
  };
}

function getSessionSecretStatus(): OperationHardeningStatus {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();

  if (
    secret &&
    secret.length >= 32 &&
    !secret.includes("replace-with") &&
    !secret.includes("change-me")
  ) {
    return "OK";
  }

  return "ACTION_REQUIRED";
}

function getMailDeliveryStatus(): OperationHardeningStatus {
  return process.env.MAIL_FROM?.trim() && process.env.MAIL_SMTP_HOST?.trim()
    ? "OK"
    : "ACTION_REQUIRED";
}

function getOidcProviderStatus(): OperationHardeningStatus {
  return process.env.OIDC_ISSUER_URL?.trim() &&
    process.env.OIDC_CLIENT_ID?.trim() &&
    process.env.OIDC_CLIENT_SECRET?.trim()
    ? "OK"
    : "ATTENTION";
}

function getAggregateHardeningStatus(
  items: OperationHardeningItem[],
): OperationHardeningStatus {
  if (items.some((item) => item.status === "ACTION_REQUIRED")) {
    return "ACTION_REQUIRED";
  }

  if (items.some((item) => item.status === "ATTENTION")) {
    return "ATTENTION";
  }

  return "OK";
}
