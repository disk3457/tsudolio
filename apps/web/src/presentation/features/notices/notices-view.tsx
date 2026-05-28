"use client";

import { AlertCircle } from "lucide-react";
import { NoticeForm } from "@/presentation/features/notices/components/notice-form";
import { NoticeList } from "@/presentation/features/notices/components/notice-list";
import { NoticeStats } from "@/presentation/features/notices/components/notice-stats";
import { NoticeToolbar } from "@/presentation/features/notices/components/notice-toolbar";
import { NotificationPanel } from "@/presentation/features/notices/components/notification-panel";
import { useNoticeCenter } from "@/presentation/features/notices/use-notice-center";

export function NoticesView() {
  const {
    acknowledgingId,
    activeFilter,
    closeForm,
    deletingId,
    formState,
    handleAcknowledge,
    handleDelete,
    handleMarkNotificationRead,
    handleSubmit,
    loadNotices,
    noticeState,
    notifications,
    openCreateForm,
    openEditForm,
    organizationUnits,
    readingNotificationId,
    saving,
    setActiveFilter,
    updateForm,
    visibleNotices,
  } = useNoticeCenter();
  const snapshot = noticeState.snapshot;
  const timezone = snapshot?.tenant.timezone ?? "Asia/Tokyo";

  return (
    <section className="viewStack">
      <NoticeToolbar
        activeFilter={activeFilter}
        canManage={snapshot?.canManage ?? false}
        onActiveFilterChange={setActiveFilter}
        onOpenCreateForm={openCreateForm}
        onRefresh={() => void loadNotices()}
      />

      {noticeState.message && (
        <div className="viewAlert" role="alert">
          <AlertCircle aria-hidden="true" size={18} />
          <p>{noticeState.message}</p>
        </div>
      )}

      <NoticeForm
        form={formState}
        onCancel={closeForm}
        onSubmit={(event) => void handleSubmit(event)}
        onUpdateField={updateForm}
        organizationUnits={organizationUnits}
        saving={saving}
      />

      <NoticeStats
        acknowledgementRequired={
          snapshot?.stats.acknowledgementRequired ?? 0
        }
        activeNotices={snapshot?.stats.activeNotices ?? 0}
        unacknowledged={snapshot?.stats.unacknowledged ?? 0}
        unreadNotifications={snapshot?.stats.unreadNotifications ?? 0}
      />

      <section className="noticeWorkspace">
        <NoticeList
          acknowledgingId={acknowledgingId}
          canManage={snapshot?.canManage ?? false}
          deletingId={deletingId}
          notices={visibleNotices}
          onAcknowledge={(notice) => void handleAcknowledge(notice)}
          onDelete={(notice) => void handleDelete(notice)}
          onEdit={openEditForm}
          status={noticeState.status}
          timezone={timezone}
        />
        <NotificationPanel
          notifications={notifications}
          onMarkRead={(notification) =>
            void handleMarkNotificationRead(notification)
          }
          readingNotificationId={readingNotificationId}
          status={noticeState.status}
          timezone={timezone}
        />
      </section>
    </section>
  );
}
