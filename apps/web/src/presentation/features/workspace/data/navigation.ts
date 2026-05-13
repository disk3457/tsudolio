import {
  CalendarDays,
  FileText,
  LayoutDashboard,
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
