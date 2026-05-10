import { Bell, Building2, Database } from "lucide-react";

export const securityItems = [
  "管理者は多要素認証を必須化",
  "組織・部署単位でアクセス範囲を制御",
  "監査ログは改ざん検知を前提に保存",
  "リポジトリに秘密情報を含めない",
];

export const scheduleDays = [
  {
    label: "今日",
    date: "5月9日",
    events: [
      ["09:00", "災害対策連絡会", "第2会議室"],
      ["11:00", "地域連携カンファレンス", "オンライン"],
      ["15:30", "監査ログ確認", "情報政策課"],
    ],
  },
  {
    label: "明日",
    date: "5月10日",
    events: [
      ["10:00", "定例部長会", "大会議室"],
      ["13:30", "外部委託レビュー", "第1会議室"],
    ],
  },
  {
    label: "今週",
    date: "5月11日から",
    events: [
      ["火 09:30", "電子決裁説明会", "研修室"],
      ["水 14:00", "感染対策委員会", "講堂"],
      ["金 16:00", "月次報告締切", "各部署"],
    ],
  },
];

export const facilities = [
  { name: "第1会議室", status: "利用中", next: "13:00から空き", tone: "busy" },
  { name: "大会議室", status: "予約可", next: "終日 3 枠あり", tone: "open" },
  { name: "公用車 02", status: "確認中", next: "管理者承認待ち", tone: "wait" },
];

export const departments = [
  {
    name: "総務課",
    type: "自治体",
    users: "82名",
    lead: "佐藤 課長",
    children: ["防災安全課", "情報政策課", "契約検査室"],
  },
  {
    name: "医療安全管理室",
    type: "病院",
    users: "36名",
    lead: "中村 室長",
    children: ["医事課", "看護部", "施設管理"],
  },
  {
    name: "コーポレート本部",
    type: "民間",
    users: "128名",
    lead: "田中 本部長",
    children: ["人事", "経理", "情報システム"],
  },
];

export const roleAssignments = [
  {
    role: "システム管理者",
    scope: "全テナント設定",
    members: "4名",
    policy: "MFA必須 / 操作ログ常時記録",
  },
  {
    role: "部門管理者",
    scope: "所属組織と配下",
    members: "42名",
    policy: "利用者招待と施設予約を管理",
  },
  {
    role: "一般利用者",
    scope: "本人と所属部署",
    members: "1,202名",
    policy: "予定、掲示、申請を利用",
  },
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
