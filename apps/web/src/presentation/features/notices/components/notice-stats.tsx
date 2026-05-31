import { Bell, CheckCircle2, Megaphone, MessageCircleWarning } from "lucide-react";
import { formatNumber } from "@/shared/formatters";

type NoticeStatsProps = {
  activeNotices: number;
  acknowledgementRequired: number;
  unacknowledged: number;
  unreadNotifications: number;
};

export function NoticeStats({
  activeNotices,
  acknowledgementRequired,
  unacknowledged,
  unreadNotifications,
}: NoticeStatsProps) {
  const stats = [
    {
      label: "掲載中",
      value: activeNotices,
      icon: Megaphone,
    },
    {
      label: "確認必須",
      value: acknowledgementRequired,
      icon: CheckCircle2,
    },
    {
      label: "未確認",
      value: unacknowledged,
      icon: MessageCircleWarning,
    },
    {
      label: "未読通知",
      value: unreadNotifications,
      icon: Bell,
    },
  ];

  return (
    <section className="noticeStats" aria-label="掲示と通知の概要">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <article key={stat.label}>
            <Icon aria-hidden="true" size={18} />
            <div>
              <p className="metricLabel">{stat.label}</p>
              <strong>{formatNumber(stat.value)}</strong>
            </div>
          </article>
        );
      })}
    </section>
  );
}
