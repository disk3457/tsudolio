import type { LucideIcon } from "lucide-react";
import type { ViewKey } from "@/features/workspace/types";

export type DashboardSnapshot = {
  tenant: {
    code: string;
    name: string;
    type: string;
    timezone: string;
  };
  metrics: {
    activeUsers: number;
    pendingApprovals: number;
    auditEvents: number;
    unreadNotifications: number;
  };
  modules: Array<{
    key: string;
    title: string;
    status: string;
    summary: string;
  }>;
  timeline: Array<{
    startsAt: string;
    title: string;
    location: string | null;
    organizationUnit: string | null;
  }>;
  approvals: Array<{
    title: string;
    category: string;
    owner: string | null;
    dueAt: string | null;
    priority: string;
  }>;
  securityEvents: Array<{
    createdAt: string;
    action: string;
    severity: string;
    actor: string | null;
  }>;
};

export type DashboardApiResponse =
  | {
      data: DashboardSnapshot;
      source: "database";
    }
  | {
      error: string;
      message: string;
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
