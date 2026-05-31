import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import type { NoticeSummary } from "@/application/notices/types";
import { EmptyState } from "@/presentation/components/empty-state";
import { formatDateTime } from "@/shared/formatters";

type NoticeListProps = {
  acknowledgingId: string | null;
  canManage: boolean;
  deletingId: string | null;
  notices: NoticeSummary[];
  onAcknowledge: (notice: NoticeSummary) => void;
  onDelete: (notice: NoticeSummary) => void;
  onEdit: (notice: NoticeSummary) => void;
  status: "loading" | "ready" | "error";
  timezone: string;
};

export function NoticeList({
  acknowledgingId,
  canManage,
  deletingId,
  notices,
  onAcknowledge,
  onDelete,
  onEdit,
  status,
  timezone,
}: NoticeListProps) {
  return (
    <section className="panel noticeListPanel" aria-labelledby="notice-list-heading">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">掲示板</p>
          <h2 id="notice-list-heading">掲示一覧</h2>
        </div>
      </div>

      <div className="noticeList">
        {notices.length === 0 && (
          <EmptyState
            title={
              status === "loading"
                ? "掲示を取得しています"
                : "表示できる掲示がありません"
            }
            description="条件を変えると別の掲示が表示されます。"
          />
        )}
        {notices.map((notice) => (
          <article
            className={`noticeCard ${notice.tone} ${
              notice.canAcknowledge ? "attention" : ""
            }`}
            key={notice.id}
          >
            <div className="noticeCardHeader">
              <div>
                <span className={`noticeStatus ${notice.tone}`}>
                  {notice.statusLabel}
                </span>
                <span className="noticeScope">
                  {notice.organizationUnit?.name ?? "全体"}
                </span>
              </div>
              {notice.requiresAck && (
                <span
                  className={`noticeAckBadge ${
                    notice.acknowledgedAt ? "done" : "pending"
                  }`}
                >
                  {notice.acknowledgedAt ? "確認済" : "未確認"}
                </span>
              )}
            </div>
            <div className="noticeCardBody">
              <h3>{notice.title}</h3>
              <p>{notice.body}</p>
            </div>
            <dl className="noticeMeta">
              <div>
                <dt>公開</dt>
                <dd>{formatDateTime(notice.publishedAt, timezone)}</dd>
              </div>
              <div>
                <dt>終了</dt>
                <dd>
                  {notice.expiresAt
                    ? formatDateTime(notice.expiresAt, timezone)
                    : "期限なし"}
                </dd>
              </div>
            </dl>
            <div className="noticeActions">
              {notice.canAcknowledge && (
                <button
                  className="textButton primary"
                  disabled={acknowledgingId === notice.id}
                  onClick={() => onAcknowledge(notice)}
                  type="button"
                >
                  <CheckCircle2 aria-hidden="true" size={16} />
                  {acknowledgingId === notice.id ? "確認中" : "確認"}
                </button>
              )}
              {canManage && (
                <>
                  <button
                    className="iconButton"
                    aria-label={`${notice.title}を編集`}
                    onClick={() => onEdit(notice)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={16} />
                  </button>
                  <button
                    className="iconButton"
                    aria-label={`${notice.title}を削除`}
                    disabled={deletingId === notice.id}
                    onClick={() => onDelete(notice)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
