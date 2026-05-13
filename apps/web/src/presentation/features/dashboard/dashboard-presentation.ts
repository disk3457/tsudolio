import {
  CalendarDays,
  ClipboardList,
  Database,
  FileText,
  MessageSquareText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardSnapshot } from "@/application/dashboard/types";
import type { ViewKey } from "@/presentation/features/workspace/types";

type ModulePresentation = {
  icon: LucideIcon;
  label: string;
  target: ViewKey;
  tone: "blue" | "cyan" | "rose" | "sky";
};

export const modulePresentation: Record<string, ModulePresentation> = {
  schedule: {
    icon: CalendarDays,
    label: "スケジュール",
    target: "schedule",
    tone: "blue",
  },
  notices: {
    icon: MessageSquareText,
    label: "お知らせ",
    target: "dashboard",
    tone: "cyan",
  },
  workflow: {
    icon: ClipboardList,
    label: "ワークフロー",
    target: "dashboard",
    tone: "rose",
  },
  documents: {
    icon: FileText,
    label: "ファイル共有",
    target: "documents",
    tone: "sky",
  },
};

export const defaultModulePresentation: ModulePresentation = {
  icon: Database,
  label: "機能",
  target: "dashboard",
  tone: "blue",
};

export const fallbackModules: DashboardSnapshot["modules"] = [
  {
    key: "schedule",
    title: "予定・施設予約",
    summary: "DB接続後に予定と施設予約を表示します",
    status: "取得待ち",
  },
  {
    key: "notices",
    title: "掲示・回覧",
    summary: "DB接続後に有効な掲示と未読通知を表示します",
    status: "取得待ち",
  },
  {
    key: "workflow",
    title: "申請・承認",
    summary: "DB接続後に承認待ちと緊急申請を表示します",
    status: "取得待ち",
  },
  {
    key: "documents",
    title: "文書管理",
    summary: "DB接続後に文書台帳の件数を表示します",
    status: "取得待ち",
  },
];
