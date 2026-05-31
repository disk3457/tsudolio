import { Check, MailOpen } from "lucide-react";
import type { NotificationSummary } from "@/application/notices/types";
import { EmptyState } from "@/presentation/components/empty-state";
import { formatDateTime } from "@/shared/formatters";

type NotificationPanelProps = {
  notifications: NotificationSummary[];
  onMarkRead: (notification: NotificationSummary) => void;
  readingNotificationId: string | null;
  status: "loading" | "ready" | "error";
  timezone: string;
};

export function NotificationPanel({
  notifications,
  onMarkRead,
  readingNotificationId,
  status,
  timezone,
}: NotificationPanelProps) {
  return (
    <aside className="panel notificationPanel" aria-labelledby="notification-heading">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">通知</p>
          <h2 id="notification-heading">受信箱</h2>
        </div>
        <MailOpen aria-hidden="true" className="panelIcon" size={20} />
      </div>

      <div className="notificationList">
        {notifications.length === 0 && (
          <EmptyState
            title={status === "loading" ? "通知を取得しています" : "通知はありません"}
            description="未読と最新の通知がここに表示されます。"
          />
        )}
        {notifications.map((notification) => (
          <article
            className={`notificationItem ${notification.readAt ? "read" : "unread"}`}
            key={notification.id}
          >
            <div>
              <time>{formatDateTime(notification.createdAt, timezone)}</time>
              <h3>{notification.title}</h3>
              <p>{notification.body}</p>
            </div>
            {!notification.readAt && (
              <button
                className="iconButton"
                aria-label={`${notification.title}を既読にする`}
                disabled={readingNotificationId === notification.id}
                onClick={() => onMarkRead(notification)}
                type="button"
              >
                <Check aria-hidden="true" size={16} />
              </button>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}
