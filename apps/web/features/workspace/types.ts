import type { LucideIcon } from "lucide-react";
import type { DashboardSnapshot } from "@/lib/dashboard-types";

export type ViewKey =
  | "dashboard"
  | "schedule"
  | "organization"
  | "documents"
  | "security"
  | "settings";

export type NavItem = {
  key: ViewKey;
  title: string;
  description: string;
  label: string;
  icon: LucideIcon;
};

export type DashboardLoadState = {
  snapshot: DashboardSnapshot | null;
  source: "database" | "fallback";
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

export type ModulePresentation = {
  icon: LucideIcon;
  label: string;
  target: ViewKey;
  tone: "blue" | "cyan" | "rose" | "sky";
};
