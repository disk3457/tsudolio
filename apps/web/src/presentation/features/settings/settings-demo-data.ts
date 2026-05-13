import { Bell, Building2, Database } from "lucide-react";

export const settingGroups = [
  {
    title: "組織プロファイル",
    icon: Building2,
    items: [
      "表示名: デモ市総合病院",
      "業種テンプレート: 自治体・医療併用",
      "標準タイムゾーン: Asia/Tokyo",
    ],
  },
  {
    title: "通知",
    icon: Bell,
    items: [
      "承認期限前の通知を有効化",
      "重要掲示は既読確認を必須化",
      "スマホPWAの通知連携を準備中",
    ],
  },
  {
    title: "保管ルール",
    icon: Database,
    items: [
      "監査ログ: 7年保管",
      "申請添付: 文書分類に連動",
      "削除操作は論理削除で記録",
    ],
  },
];
