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
