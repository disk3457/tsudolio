# Data Model

## Core

- `tenant`: 自治体、病院、民間企業などの契約・運用境界。高権限利用者のPasskey必須化ポリシーを保持する。
- `organization_unit`: 部署、病棟、支店、チーム、外部委託先などの階層
- `user`: 人のアカウント
- `user_credential`: 通常ログイン用のパスワードハッシュとロック状態
- `password_reset_token`: パスワードリセット用の短期トークンハッシュ
- `webauthn_credential`: Passkey/WebAuthn 認証器の公開鍵と署名カウンタ
- `webauthn_authentication_challenge`: Passkeyログイン時の短期チャレンジハッシュ
- `webauthn_registration_challenge`: Passkey登録時の短期チャレンジハッシュ
- `membership`: 利用者と組織の所属関係
- `role`: テナント内で定義する権限束
- `permission`: 機能単位の細かな権限
- `role_permission`: ロールと権限の対応
- `role_assignment`: 所属に対するロール付与
- `audit_event`: 操作証跡

## Groupware

- `calendar_event`: 予定
- `facility`: 会議室、公用車、設備などの予約対象
- `facility_reservation`: 施設予約
- `notice`: 掲示、回覧
- `workflow_request`: 申請、承認待ち、決裁済みの案件
- `document`: 文書台帳とストレージ参照
- `notification`: 個人向け通知

## Implementation

- Prisma schema: `apps/web/prisma/schema.prisma`
- Initial migration: `apps/web/prisma/migrations/20260509195500_init/migration.sql`
- Local seed: `apps/web/prisma/seed.ts`
- Dashboard API: `GET /api/dashboard`
- Health API: `GET /api/health`

## Required Columns

Most tables should include:

- `id`
- `tenant_id`
- `created_at`
- `created_by`
- `updated_at`
- `updated_by`

Security-sensitive tables should include immutable event records instead of destructive updates.
