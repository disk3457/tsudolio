import type {
  NoticeCenterSnapshot,
  NoticeInput,
  NoticeSummary,
  NotificationSummary,
} from "@/application/notices/types";
import type {
  CurrentUserContext,
  MutationContext,
} from "@/application/security/types";

export type NoticeRepository = {
  getNoticeCenterSnapshot: (
    currentUser: CurrentUserContext,
  ) => Promise<NoticeCenterSnapshot>;
  createNotice: (
    input: NoticeInput,
    context: MutationContext,
  ) => Promise<NoticeSummary>;
  updateNotice: (
    noticeId: string,
    input: NoticeInput,
    context: MutationContext,
  ) => Promise<NoticeSummary>;
  deleteNotice: (noticeId: string, context: MutationContext) => Promise<void>;
  acknowledgeNotice: (
    noticeId: string,
    currentUser: CurrentUserContext,
    context: MutationContext,
  ) => Promise<NoticeSummary>;
  markNotificationRead: (
    notificationId: string,
    currentUser: CurrentUserContext,
  ) => Promise<NotificationSummary>;
};

export function createNoticeUseCases(repository: NoticeRepository) {
  return {
    getNoticeCenterSnapshot: repository.getNoticeCenterSnapshot,
    createNotice: repository.createNotice,
    updateNotice: repository.updateNotice,
    deleteNotice: repository.deleteNotice,
    acknowledgeNotice: repository.acknowledgeNotice,
    markNotificationRead: repository.markNotificationRead,
  };
}
