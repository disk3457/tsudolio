export type NoticeStatus = "SCHEDULED" | "ACTIVE" | "EXPIRED";

export type NoticeOption = {
  id: string;
  name: string;
};

export type NoticeSummary = {
  id: string;
  title: string;
  body: string;
  requiresAck: boolean;
  publishedAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: NoticeStatus;
  statusLabel: string;
  tone: "open" | "wait" | "busy";
  organizationUnit: NoticeOption | null;
  acknowledgedAt: string | null;
  canAcknowledge: boolean;
};

export type NotificationSummary = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type NoticeCenterSnapshot = {
  tenant: {
    code: string;
    name: string;
    timezone: string;
  };
  canManage: boolean;
  notices: NoticeSummary[];
  notifications: NotificationSummary[];
  organizationUnits: NoticeOption[];
  stats: {
    activeNotices: number;
    acknowledgementRequired: number;
    unacknowledged: number;
    unreadNotifications: number;
  };
};

export type NoticeInput = {
  title: string;
  body: string;
  requiresAck: boolean;
  publishedAt: string;
  expiresAt: string | null;
  organizationUnitId: string | null;
};

export type NoticesApiResponse =
  | {
      data: NoticeCenterSnapshot;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type NoticeMutationResponse =
  | {
      data: NoticeSummary;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type NoticeDeleteResponse =
  | {
      data: {
        id: string;
        deleted: boolean;
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type NotificationMutationResponse =
  | {
      data: NotificationSummary;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };
