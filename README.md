# Tsudolio（ツドリオ）

自治体、病院、民間企業で共通利用できることを目指す、公開前提のグループウェア基盤です。最初は Web/PWA として実装し、スマートフォンとデスクトップの両方で使える業務画面から育てます。

## Goals

- Web/PWA first: スマホ、タブレット、PC で同一コードベースを利用する
- Public by default: GitHub 公開を前提に、秘密情報をリポジトリに含めない
- Multi-tenant ready: SaaS、庁内/院内単独環境、閉域網展開に耐える構成にする
- Security first: 監査ログ、権限管理、MFA/SSO、バックアップを初期設計に含める
- Modular domains: 自治体、医療、民間向けの差分は後付けモジュールに分ける

## MVP Scope

- 認証、SSO、MFA の受け皿
- 組織、部署、役職、権限管理
- スケジュール、施設予約
- 掲示板、回覧、通知
- 申請、承認ワークフロー
- ファイル管理
- 監査ログ
- 管理者向けテナント設定

## Tech Stack

- Monorepo: npm workspaces
- Web: Next.js, TypeScript, React
- UI: CSS Modules/global CSS, lucide-react
- Database: PostgreSQL
- Object storage: S3 compatible storage, MinIO for local development
- Future API: Fastify or NestJS with OpenAPI
- Future auth: OIDC/SAML via Keycloak or managed IdP

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Local infrastructure can be started with:

```bash
docker compose up -d
```

## Repository Layout

```text
apps/web/          Next.js PWA front end
docs/              architecture, security, roadmap, data model
.github/           CI and dependency automation
docker-compose.yml local PostgreSQL, MinIO, and Mailpit
```

## Current Status

This repository is at project bootstrap stage. The first milestone is a usable web dashboard with mock operational data, followed by real authentication, persistence, and audit trails.
