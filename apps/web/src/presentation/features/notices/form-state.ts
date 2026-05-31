import type { NoticeInput, NoticeSummary } from "@/application/notices/types";
import type { NoticeFormState } from "@/presentation/features/notices/view-types";

export function createDefaultNoticeFormState(): NoticeFormState {
  return {
    id: null,
    title: "",
    body: "",
    requiresAck: true,
    publishedAt: formatDateTimeInput(new Date().toISOString()),
    expiresAt: "",
    organizationUnitId: "",
  };
}

export function noticeToFormState(notice: NoticeSummary): NoticeFormState {
  return {
    id: notice.id,
    title: notice.title,
    body: notice.body,
    requiresAck: notice.requiresAck,
    publishedAt: formatDateTimeInput(notice.publishedAt),
    expiresAt: notice.expiresAt ? formatDateTimeInput(notice.expiresAt) : "",
    organizationUnitId: notice.organizationUnit?.id ?? "",
  };
}

export function noticeFormToInput(form: NoticeFormState): NoticeInput {
  return {
    title: form.title,
    body: form.body,
    requiresAck: form.requiresAck,
    publishedAt: new Date(form.publishedAt).toISOString(),
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    organizationUnitId: form.organizationUnitId || null,
  };
}

function formatDateTimeInput(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
