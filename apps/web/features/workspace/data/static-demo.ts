import { Bell, Building2, Database } from "lucide-react";

export const securityItems = [
  "管理者は多要素認証を必須化",
  "組織・部署単位でアクセス範囲を制御",
  "監査ログは改ざん検知を前提に保存",
  "リポジトリに秘密情報を含めない",
];

export const documentRows = [
  {
    title: "個人情報取扱マニュアル",
    area: "セキュリティ",
    owner: "情報政策課",
    version: "v3.2",
    retention: "2031年3月",
    status: "最新版",
  },
  {
    title: "災害時連絡体制",
    area: "BCP",
    owner: "防災安全課",
    version: "v1.8",
    retention: "常用",
    status: "回覧中",
  },
  {
    title: "設備点検報告書",
    area: "施設",
    owner: "施設管理",
    version: "v2.0",
    retention: "2029年5月",
    status: "承認待ち",
  },
  {
    title: "委託先アカウント一覧",
    area: "外部連携",
    owner: "情報システム",
    version: "v1.4",
    retention: "2027年12月",
    status: "要確認",
  },
];

export const settingGroups = [
  {
    title: "組織プロファイル",
    icon: Building2,
    items: ["表示名: デモ市総合病院", "業種テンプレート: 自治体・医療併用", "標準タイムゾーン: Asia/Tokyo"],
  },
  {
    title: "通知",
    icon: Bell,
    items: ["承認期限前の通知を有効化", "重要掲示は既読確認を必須化", "スマホPWAの通知連携を準備中"],
  },
  {
    title: "保管ルール",
    icon: Database,
    items: ["監査ログ: 7年保管", "申請添付: 文書分類に連動", "削除操作は論理削除で記録"],
  },
];
