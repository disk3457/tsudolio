"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { EmptyState } from "@/presentation/components/empty-state";
import { FacilityManagementPanel } from "@/presentation/features/facilities/facility-management-panel";
import type {
  ScheduleApiResponse,
  ScheduleEventInput,
  ScheduleEventMutationResponse,
  ScheduleEventSummary,
  ScheduleRange,
  ScheduleSnapshot,
} from "@/application/schedule/types";

type ScheduleLoadState = {
  snapshot: ScheduleSnapshot | null;
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

type ScheduleFormState = {
  id: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  organizationUnitId: string;
  facilityId: string;
  location: string;
  visibility: ScheduleEventInput["visibility"];
  description: string;
};

const rangeOptions: Array<{ key: ScheduleRange; label: string }> = [
  { key: "today", label: "今日" },
  { key: "week", label: "週" },
  { key: "month", label: "月" },
];

const visibilityOptions: Array<{
  key: ScheduleEventInput["visibility"];
  label: string;
}> = [
  { key: "ORGANIZATION", label: "所属組織" },
  { key: "TENANT", label: "全体" },
  { key: "PRIVATE", label: "非公開" },
];

export function ScheduleView() {
  const [range, setRange] = useState<ScheduleRange>("week");
  const [scheduleState, setScheduleState] = useState<ScheduleLoadState>({
    snapshot: null,
    status: "loading",
    message: null,
    updatedAt: null,
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formState, setFormState] = useState<ScheduleFormState>(() =>
    createDefaultFormState(),
  );
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSchedule = useCallback(
    async (signal?: AbortSignal) => {
      setScheduleState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "loading",
        message: null,
      }));

      try {
        const response = await fetch(`/api/schedule?range=${range}`, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal,
        });
        const body = (await response.json()) as ScheduleApiResponse;

        if (!response.ok || !("data" in body)) {
          throw new Error(
            "message" in body ? body.message : "予定データを取得できませんでした",
          );
        }

        setScheduleState({
          snapshot: body.data,
          status: "ready",
          message: null,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setScheduleState((current) => ({
          ...current,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "予定データを取得できませんでした",
        }));
      }
    },
    [range],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadSchedule(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadSchedule]);

  const dayGroups = useMemo(
    () => groupEventsByDay(scheduleState.snapshot?.events ?? []),
    [scheduleState.snapshot?.events],
  );
  const selectedFacility = scheduleState.snapshot?.facilities.find(
    (facility) => facility.id === formState.facilityId,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setScheduleState((current) => ({
      ...current,
      message: null,
    }));

    try {
      const payload = formStateToInput(formState);
      const response = await fetch(
        formState.id ? `/api/schedule/${formState.id}` : "/api/schedule",
        {
          method: formState.id ? "PATCH" : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as ScheduleEventMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "予定を保存できませんでした",
        );
      }

      setFormState(createDefaultFormState());
      setIsFormOpen(false);
      await loadSchedule();
    } catch (error) {
      setScheduleState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "予定を保存できませんでした",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(event: ScheduleEventSummary) {
    if (!window.confirm(`${event.title} を削除しますか？`)) {
      return;
    }

    setDeletingId(event.id);
    setScheduleState((current) => ({
      ...current,
      message: null,
    }));

    try {
      const response = await fetch(`/api/schedule/${event.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });
      const body = (await response.json()) as ScheduleEventMutationResponse;

      if (!response.ok || "error" in body) {
        throw new Error(
          "message" in body ? body.message : "予定を削除できませんでした",
        );
      }

      if (formState.id === event.id) {
        setFormState(createDefaultFormState());
        setIsFormOpen(false);
      }

      await loadSchedule();
    } catch (error) {
      setScheduleState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "予定を削除できませんでした",
      }));
    } finally {
      setDeletingId(null);
    }
  }

  function openCreateForm() {
    setFormState(createDefaultFormState());
    setIsFormOpen(true);
  }

  function openEditForm(event: ScheduleEventSummary) {
    setFormState(eventToFormState(event));
    setIsFormOpen(true);
  }

  function closeForm() {
    setFormState(createDefaultFormState());
    setIsFormOpen(false);
  }

  function updateForm<Field extends keyof ScheduleFormState>(
    field: Field,
    value: ScheduleFormState[Field],
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateFacility(facilityId: string) {
    const facility = scheduleState.snapshot?.facilities.find(
      (item) => item.id === facilityId,
    );

    setFormState((current) => ({
      ...current,
      facilityId,
      location:
        facility && !current.location
          ? facility.location ?? facility.name
          : current.location,
    }));
  }

  return (
    <section className="viewStack">
      <div className="viewToolbar" aria-label="予定操作">
        <div className="segmentedControl" aria-label="表示期間">
          {rangeOptions.map((option) => (
            <button
              className={range === option.key ? "active" : ""}
              key={option.key}
              onClick={() => setRange(option.key)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="toolbarActions">
          <button
            className="iconButton"
            aria-label="予定を再読み込み"
            onClick={() => void loadSchedule()}
            type="button"
          >
            <RefreshCcw aria-hidden="true" size={18} />
          </button>
          <button className="textButton primary" onClick={openCreateForm} type="button">
            <Plus aria-hidden="true" size={17} />
            予定を登録
          </button>
        </div>
      </div>

      {scheduleState.message && (
        <div className="scheduleAlert" role="alert">
          <AlertCircle aria-hidden="true" size={18} />
          <p>{scheduleState.message}</p>
        </div>
      )}

      {isFormOpen && (
        <form className="panel scheduleForm" onSubmit={handleSubmit}>
          <div className="panelHeader compact">
            <div>
              <p className="sectionLabel">
                {formState.id ? "予定更新" : "新規予定"}
              </p>
              <h2>{formState.id ? "予定を編集" : "予定を登録"}</h2>
            </div>
            <button
              className="iconButton"
              aria-label="フォームを閉じる"
              onClick={closeForm}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          <div className="formGrid">
            <label className="fieldControl wide">
              <span>件名</span>
              <input
                maxLength={200}
                onChange={(event) => updateForm("title", event.target.value)}
                required
                value={formState.title}
              />
            </label>
            <label className="fieldControl">
              <span>日付</span>
              <input
                onChange={(event) => updateForm("date", event.target.value)}
                required
                type="date"
                value={formState.date}
              />
            </label>
            <label className="fieldControl">
              <span>開始</span>
              <input
                onChange={(event) => updateForm("startTime", event.target.value)}
                required
                type="time"
                value={formState.startTime}
              />
            </label>
            <label className="fieldControl">
              <span>終了</span>
              <input
                onChange={(event) => updateForm("endTime", event.target.value)}
                required
                type="time"
                value={formState.endTime}
              />
            </label>
            <label className="fieldControl">
              <span>組織</span>
              <select
                onChange={(event) =>
                  updateForm("organizationUnitId", event.target.value)
                }
                value={formState.organizationUnitId}
              >
                <option value="">未指定</option>
                {scheduleState.snapshot?.organizationUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldControl">
              <span>施設</span>
              <select
                onChange={(event) => updateFacility(event.target.value)}
                value={formState.facilityId}
              >
                <option value="">予約なし</option>
                {scheduleState.snapshot?.facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name} / {facility.statusLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldControl">
              <span>公開範囲</span>
              <select
                onChange={(event) =>
                  updateForm(
                    "visibility",
                    event.target.value as ScheduleEventInput["visibility"],
                  )
                }
                value={formState.visibility}
              >
                {visibilityOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldControl wide">
              <span>場所</span>
              <input
                maxLength={200}
                onChange={(event) => updateForm("location", event.target.value)}
                value={formState.location}
              />
            </label>
            <label className="fieldControl wide">
              <span>説明</span>
              <textarea
                maxLength={4000}
                onChange={(event) => updateForm("description", event.target.value)}
                rows={3}
                value={formState.description}
              />
            </label>
          </div>

          <div className="formFooter">
            {selectedFacility && (
              <p>
                {selectedFacility.name} / {selectedFacility.statusLabel}
                {selectedFacility.capacity
                  ? ` / 定員${selectedFacility.capacity}名`
                  : ""}
              </p>
            )}
            <div className="actionRow">
              <button className="textButton" onClick={closeForm} type="button">
                <X aria-hidden="true" size={16} />
                キャンセル
              </button>
              <button className="textButton primary" disabled={saving} type="submit">
                <Save aria-hidden="true" size={16} />
                {saving ? "保存中" : "保存"}
              </button>
            </div>
          </div>
        </form>
      )}

      <section className="scheduleBoard" aria-label="予定一覧">
        {scheduleState.status === "loading" && (
          <article className="panel dayColumn">
            <div className="panelHeader compact">
              <div>
                <p className="sectionLabel">読み込み中</p>
                <h2>予定を取得しています</h2>
              </div>
              <Clock3 aria-hidden="true" className="panelIcon" size={20} />
            </div>
            <EmptyState title="取得中" description="予定と施設予約を確認しています。" />
          </article>
        )}

        {scheduleState.status !== "loading" && dayGroups.length === 0 && (
          <article className="panel dayColumn">
            <div className="panelHeader compact">
              <div>
                <p className="sectionLabel">予定一覧</p>
                <h2>登録済みの予定はありません</h2>
              </div>
              <CalendarDays aria-hidden="true" className="panelIcon" size={20} />
            </div>
            <EmptyState
              title="予定なし"
              description="この期間に表示できる予定はまだ登録されていません。"
            />
          </article>
        )}

        {scheduleState.status !== "loading" &&
          dayGroups.map((day) => (
            <article className="panel dayColumn" key={day.key}>
              <div className="panelHeader compact">
                <div>
                  <p className="sectionLabel">{day.weekday}</p>
                  <h2>{day.label}</h2>
                </div>
                <Clock3 aria-hidden="true" className="panelIcon" size={20} />
              </div>
              <div className="timeline">
                {day.events.map((event) => (
                  <article className="timelineItem compact scheduleEvent" key={event.id}>
                    <time>
                      {formatTime(event.startsAt)}
                      <span>{formatTime(event.endsAt)}</span>
                    </time>
                    <div>
                      <div className="scheduleEventHeader">
                        <h3>{event.title}</h3>
                        {event.reservation && (
                          <span className="reservationBadge">
                            {event.reservation.statusLabel}
                          </span>
                        )}
                      </div>
                      <p>
                        {event.reservation?.facility.name ??
                          event.location ??
                          "場所未指定"}
                      </p>
                      <div className="eventMeta">
                        <span>{event.organizationUnit?.name ?? "組織未指定"}</span>
                        <span>{visibilityLabel(event.visibility)}</span>
                      </div>
                      <div className="eventActions">
                        <button
                          className="iconButton compact"
                          aria-label={`${event.title}を編集`}
                          onClick={() => openEditForm(event)}
                          type="button"
                        >
                          <Pencil aria-hidden="true" size={15} />
                        </button>
                        <button
                          className="iconButton compact danger"
                          aria-label={`${event.title}を削除`}
                          disabled={deletingId === event.id}
                          onClick={() => void handleDelete(event)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          ))}
      </section>

      <section className="quickCards" aria-label="施設予約状況">
        {scheduleState.snapshot?.facilities.map((facility) => (
          <article className="panel facilityCard" key={facility.id}>
            <div>
              <p className="sectionLabel">施設予約</p>
              <h2>{facility.name}</h2>
              <p>
                {facility.nextReservation
                  ? `${formatDateTime(facility.nextReservation.startsAt)} ${facility.nextReservation.purpose}`
                  : "直近の予約なし"}
              </p>
              <span className="facilityMeta">
                {facility.location ?? "場所未設定"}
                {facility.capacity ? ` / 定員${facility.capacity}名` : ""}
              </span>
            </div>
            <span className={`statusPill ${facility.tone}`}>
              {facility.statusLabel}
            </span>
          </article>
        ))}
      </section>

      <FacilityManagementPanel />
    </section>
  );
}

function createDefaultFormState(): ScheduleFormState {
  const startsAt = roundToNextHalfHour(new Date());
  const endsAt = addMinutes(startsAt, 60);

  return {
    id: null,
    title: "",
    date: formatDateInput(startsAt),
    startTime: formatTimeInput(startsAt),
    endTime: formatTimeInput(endsAt),
    organizationUnitId: "",
    facilityId: "",
    location: "",
    visibility: "ORGANIZATION",
    description: "",
  };
}

function eventToFormState(event: ScheduleEventSummary): ScheduleFormState {
  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);

  return {
    id: event.id,
    title: event.title,
    date: formatDateInput(startsAt),
    startTime: formatTimeInput(startsAt),
    endTime: formatTimeInput(endsAt),
    organizationUnitId: event.organizationUnit?.id ?? "",
    facilityId: event.reservation?.facility.id ?? "",
    location: event.location ?? "",
    visibility: event.visibility,
    description: event.description ?? "",
  };
}

function formStateToInput(formState: ScheduleFormState): ScheduleEventInput {
  return {
    title: formState.title,
    description: formState.description || null,
    startsAt: composeLocalDateTime(formState.date, formState.startTime),
    endsAt: composeLocalDateTime(formState.date, formState.endTime),
    location: formState.location || null,
    visibility: formState.visibility,
    organizationUnitId: formState.organizationUnitId || null,
    facilityId: formState.facilityId || null,
  };
}

function groupEventsByDay(events: ScheduleEventSummary[]) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      weekday: string;
      events: ScheduleEventSummary[];
    }
  >();

  events.forEach((event) => {
    const startsAt = new Date(event.startsAt);
    const key = formatDateInput(startsAt);
    const group = groups.get(key) ?? {
      key,
      label: formatDateLabel(startsAt),
      weekday: formatWeekday(startsAt),
      events: [],
    };

    group.events.push(event);
    groups.set(key, group);
  });

  return Array.from(groups.values()).sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

function roundToNextHalfHour(date: Date) {
  const next = new Date(date);
  const minutes = next.getMinutes();
  const roundedMinutes = minutes < 30 ? 30 : 60;

  next.setMinutes(roundedMinutes, 0, 0);

  return next;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function composeLocalDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatDateInput(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatTimeInput(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(11, 16);
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    weekday: "long",
  }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function visibilityLabel(visibility: ScheduleEventSummary["visibility"]) {
  const labels: Record<ScheduleEventSummary["visibility"], string> = {
    PRIVATE: "非公開",
    ORGANIZATION: "所属組織",
    TENANT: "全体",
  };

  return labels[visibility];
}
