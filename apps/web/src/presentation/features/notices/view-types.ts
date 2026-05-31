import type { NoticeCenterSnapshot } from "@/application/notices/types";

export const allNoticeFilterKey = "all" as const;

export type NoticeFilterKey = "all" | "active" | "ack" | "unacked";

export type NoticeLoadState = {
  snapshot: NoticeCenterSnapshot | null;
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

export type NoticeFormState = {
  id: string | null;
  title: string;
  body: string;
  requiresAck: boolean;
  publishedAt: string;
  expiresAt: string;
  organizationUnitId: string;
};
