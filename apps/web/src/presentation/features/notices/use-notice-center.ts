"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  NoticeDeleteResponse,
  NoticeMutationResponse,
  NoticesApiResponse,
  NoticeSummary,
  NotificationMutationResponse,
  NotificationSummary,
} from "@/application/notices/types";
import {
  createDefaultNoticeFormState,
  noticeFormToInput,
  noticeToFormState,
} from "@/presentation/features/notices/form-state";
import {
  allNoticeFilterKey,
  type NoticeFilterKey,
  type NoticeFormState,
  type NoticeLoadState,
} from "@/presentation/features/notices/view-types";

export function useNoticeCenter() {
  const [activeFilter, setActiveFilter] = useState<NoticeFilterKey>(
    allNoticeFilterKey,
  );
  const [noticeState, setNoticeState] = useState<NoticeLoadState>({
    snapshot: null,
    status: "loading",
    message: null,
    updatedAt: null,
  });
  const [formState, setFormState] = useState<NoticeFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [readingNotificationId, setReadingNotificationId] = useState<
    string | null
  >(null);

  const loadNotices = useCallback(async (signal?: AbortSignal) => {
    setNoticeState((current) => ({
      ...current,
      status: current.snapshot ? "ready" : "loading",
      message: null,
    }));

    try {
      const response = await fetch("/api/notices", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal,
      });
      const body = (await response.json()) as NoticesApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "掲示データを取得できませんでした",
        );
      }

      setNoticeState({
        snapshot: body.data,
        status: "ready",
        message: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setNoticeState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "掲示データを取得できませんでした",
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadNotices(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadNotices]);

  const notices = useMemo(
    () => noticeState.snapshot?.notices ?? [],
    [noticeState.snapshot?.notices],
  );
  const notifications = useMemo(
    () => noticeState.snapshot?.notifications ?? [],
    [noticeState.snapshot?.notifications],
  );
  const visibleNotices = useMemo(
    () => filterNotices(notices, activeFilter),
    [activeFilter, notices],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState) {
      return;
    }

    setSaving(true);
    setNoticeState((current) => ({ ...current, message: null }));

    try {
      const payload = noticeFormToInput(formState);
      const response = await fetch(
        formState.id ? `/api/notices/${formState.id}` : "/api/notices",
        {
          method: formState.id ? "PATCH" : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as NoticeMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "掲示を保存できませんでした",
        );
      }

      setFormState(null);
      setActiveFilter(allNoticeFilterKey);
      await loadNotices();
    } catch (error) {
      setNoticeState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "掲示を保存できませんでした",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(notice: NoticeSummary) {
    if (!window.confirm(`${notice.title} を削除しますか？`)) {
      return;
    }

    setDeletingId(notice.id);
    setNoticeState((current) => ({ ...current, message: null }));

    try {
      const response = await fetch(`/api/notices/${notice.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });
      const body = (await response.json()) as NoticeDeleteResponse;

      if (!response.ok || "error" in body) {
        throw new Error(
          "message" in body ? body.message : "掲示を削除できませんでした",
        );
      }

      if (formState?.id === notice.id) {
        setFormState(null);
      }

      await loadNotices();
    } catch (error) {
      setNoticeState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "掲示を削除できませんでした",
      }));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAcknowledge(notice: NoticeSummary) {
    setAcknowledgingId(notice.id);
    setNoticeState((current) => ({ ...current, message: null }));

    try {
      const response = await fetch(
        `/api/notices/${notice.id}/acknowledgements`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        },
      );
      const body = (await response.json()) as NoticeMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "掲示を確認できませんでした",
        );
      }

      await loadNotices();
    } catch (error) {
      setNoticeState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "掲示を確認できませんでした",
      }));
    } finally {
      setAcknowledgingId(null);
    }
  }

  async function handleMarkNotificationRead(notification: NotificationSummary) {
    setReadingNotificationId(notification.id);
    setNoticeState((current) => ({ ...current, message: null }));

    try {
      const response = await fetch(
        `/api/notices/notifications/${notification.id}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
          },
        },
      );
      const body = (await response.json()) as NotificationMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "通知を既読にできませんでした",
        );
      }

      await loadNotices();
    } catch (error) {
      setNoticeState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "通知を既読にできませんでした",
      }));
    } finally {
      setReadingNotificationId(null);
    }
  }

  function openCreateForm() {
    setFormState(createDefaultNoticeFormState());
  }

  function openEditForm(notice: NoticeSummary) {
    setFormState(noticeToFormState(notice));
  }

  function closeForm() {
    setFormState(null);
  }

  function updateForm<Field extends keyof NoticeFormState>(
    field: Field,
    value: NoticeFormState[Field],
  ) {
    setFormState((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  return {
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
    notices,
    notifications,
    openCreateForm,
    openEditForm,
    organizationUnits: noticeState.snapshot?.organizationUnits ?? [],
    readingNotificationId,
    saving,
    setActiveFilter,
    updateForm,
    visibleNotices,
  };
}

function filterNotices(
  notices: NoticeSummary[],
  activeFilter: NoticeFilterKey,
) {
  if (activeFilter === "active") {
    return notices.filter((notice) => notice.status === "ACTIVE");
  }

  if (activeFilter === "ack") {
    return notices.filter((notice) => notice.requiresAck);
  }

  if (activeFilter === "unacked") {
    return notices.filter((notice) => notice.canAcknowledge);
  }

  return notices;
}
