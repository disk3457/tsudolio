import {
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  ServerCog,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { NavItem } from "@/presentation/features/workspace/types";

export const navItems: NavItem[] = [
  {
    key: "dashboard",
    title: "業務ダッシュボード",
    description: "組織全体の予定、承認、通知、セキュリティ状況を一画面で確認します。",
    label: "ダッシュボード",
    icon: LayoutDashboard,
  },
  {
    key: "schedule",
    title: "予定・施設予約",
    description: "個人、部署、施設の予定を同じ流れで管理します。",
    label: "予定",
    icon: CalendarDays,
  },
  {
    key: "notices",
    title: "掲示・通知",
    description: "全体連絡、確認必須の回覧、個人通知を一か所で確認します。",
    label: "掲示",
    icon: MessageSquareText,
  },
  {
    key: "workflow",
    title: "申請・承認",
    description: "承認待ちの申請を確認し、承認、差し戻し、却下を記録します。",
    label: "申請",
    icon: ClipboardList,
  },
  {
    key: "organization",
    title: "組織・利用者",
    description: "自治体、病院、民間企業に対応できる組織階層と権限を整理します。",
    label: "組織",
    icon: UsersRound,
  },
  {
    key: "documents",
    title: "文書管理",
    description: "共有文書、規程、申請添付を版管理と保管期限つきで扱います。",
    label: "文書",
    icon: FileText,
  },
  {
    key: "operations",
    title: "運用管理",
    description: "テナント設定、バックアップ、運用ヘルスを管理します。",
    label: "運用",
    icon: ServerCog,
  },
  {
    key: "security",
    title: "セキュリティ",
    description: "監査ログ、権限、認証設定を運用者が追える形にします。",
    label: "セキュリティ",
    icon: ShieldCheck,
  },
  {
    key: "settings",
    title: "共通設定",
    description: "組織名、通知、保管ルールなど全体設定の入口です。",
    label: "設定",
    icon: Settings,
  },
];
