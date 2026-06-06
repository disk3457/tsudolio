import type { LucideIcon } from "lucide-react";

export type ViewKey =
  | "dashboard"
  | "schedule"
  | "notices"
  | "workflow"
  | "organization"
  | "documents"
  | "operations"
  | "security"
  | "settings";

export type NavItem = {
  key: ViewKey;
  title: string;
  description: string;
  label: string;
  icon: LucideIcon;
};
