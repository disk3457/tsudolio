"use client";

import {
  AlertCircle,
  CheckCircle2,
  CircleX,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { EmptyState } from "@/presentation/components/empty-state";
import type {
  FacilityStatusValue,
  FacilitySummary,
} from "@/application/facilities/types";
import { useFacilityManagement } from "@/presentation/features/facilities/use-facility-management";

const facilityStatusOptions: Array<{
  key: FacilityStatusValue;
  label: string;
}> = [
  { key: "AVAILABLE", label: "予約可" },
  { key: "APPROVAL_REQUIRED", label: "承認制" },
  { key: "IN_USE", label: "利用中" },
  { key: "MAINTENANCE", label: "停止中" },
];

export function FacilityManagementPanel() {
  const {
    closeForm,
    decideReservation,
    decidingReservationId,
    deleteFacility,
    deletingId,
    facilityState,
    formState,
    isFormOpen,
    loadFacilities,
    openCreateForm,
    openEditForm,
    saving,
    submitFacility,
    updateForm,
  } = useFacilityManagement();
  const snapshot = facilityState.snapshot;
  const stats = getFacilityStats(snapshot?.facilities ?? []);

  return (
    <section className="facilityManagement" aria-label="施設管理">
      <div className="viewToolbar">
        <div>
          <p className="sectionLabel">施設管理</p>
          <h2>施設マスタと承認待ち予約</h2>
        </div>
        <div className="toolbarActions">
          <button
            className="iconButton"
            aria-label="施設データを再読み込み"
            onClick={() => void loadFacilities()}
            type="button"
          >
            <RefreshCcw aria-hidden="true" size={18} />
          </button>
          <button
            className="textButton primary"
            onClick={openCreateForm}
            type="button"
          >
            <Plus aria-hidden="true" size={17} />
            施設を登録
          </button>
        </div>
      </div>

      {facilityState.message && (
        <div className="scheduleAlert" role="alert">
          <AlertCircle aria-hidden="true" size={18} />
          <p>{facilityState.message}</p>
        </div>
      )}

      <div className="facilityMetrics" aria-label="施設集計">
        <div>
          <span>施設</span>
          <strong>{stats.total}</strong>
        </div>
        <div>
          <span>予約可</span>
          <strong>{stats.available}</strong>
        </div>
        <div>
          <span>承認待ち</span>
          <strong>{snapshot?.pendingReservations.length ?? 0}</strong>
        </div>
      </div>

      {isFormOpen && (
        <form className="panel scheduleForm facilityForm" onSubmit={submitFacility}>
          <div className="panelHeader compact">
            <div>
              <p className="sectionLabel">
                {formState.id ? "施設更新" : "新規施設"}
              </p>
              <h2>{formState.id ? "施設を編集" : "施設を登録"}</h2>
            </div>
            <button
              className="iconButton"
              aria-label="施設フォームを閉じる"
              onClick={closeForm}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          <div className="formGrid">
            <label className="fieldControl">
              <span>施設コード</span>
              <input
                maxLength={80}
                onChange={(event) => updateForm("code", event.target.value)}
                pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,79}"
                required
                value={formState.code}
              />
            </label>
            <label className="fieldControl wide">
              <span>施設名</span>
              <input
                maxLength={160}
                onChange={(event) => updateForm("name", event.target.value)}
                required
                value={formState.name}
              />
            </label>
            <label className="fieldControl">
              <span>状態</span>
              <select
                onChange={(event) =>
                  updateForm("status", event.target.value as FacilityStatusValue)
                }
                value={formState.status}
              >
                {facilityStatusOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldControl">
              <span>管理組織</span>
              <select
                onChange={(event) =>
                  updateForm("organizationUnitId", event.target.value)
                }
                value={formState.organizationUnitId}
              >
                <option value="">未指定</option>
                {snapshot?.organizationUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldControl">
              <span>定員</span>
              <input
                max={10000}
                min={1}
                onChange={(event) => updateForm("capacity", event.target.value)}
                type="number"
                value={formState.capacity}
              />
            </label>
            <label className="fieldControl wide">
              <span>場所</span>
              <input
                maxLength={200}
                onChange={(event) => updateForm("location", event.target.value)}
                value={formState.location}
              />
            </label>
          </div>

          <div className="formFooter">
            <p>予約履歴がある施設は削除せず、停止中として運用します。</p>
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

      <div className="facilityAdminGrid">
        <section className="panel facilityDirectoryPanel" aria-label="施設一覧">
          <div className="panelHeader compact">
            <div>
              <p className="sectionLabel">施設一覧</p>
              <h2>予約対象</h2>
            </div>
            <Wrench aria-hidden="true" className="panelIcon" size={20} />
          </div>

          {facilityState.status === "loading" && !snapshot && (
            <EmptyState title="取得中" description="施設情報を読み込んでいます。" />
          )}

          {facilityState.status !== "loading" &&
            snapshot?.facilities.length === 0 && (
              <EmptyState
                title="施設なし"
                description="予約対象の施設はまだ登録されていません。"
              />
            )}

          <div className="facilityDirectory">
            {snapshot?.facilities.map((facility) => (
              <article className="facilityAdminItem" key={facility.id}>
                <div>
                  <div className="facilityAdminHeader">
                    <h3>{facility.name}</h3>
                    <span className={`statusPill ${facility.tone}`}>
                      {facility.statusLabel}
                    </span>
                  </div>
                  <p>
                    {facility.code} /{" "}
                    {facility.organizationUnit?.name ?? "管理組織未指定"}
                  </p>
                  <div className="eventMeta">
                    <span>
                      {facility.capacity ? `定員${facility.capacity}名` : "定員未設定"}
                    </span>
                    <span>{facility.location ?? "場所未設定"}</span>
                    <span>有効予約 {facility.activeReservationCount}</span>
                  </div>
                  <p className="facilityNextReservation">
                    {facility.nextReservation
                      ? `${formatDateTime(
                          facility.nextReservation.startsAt,
                        )} ${facility.nextReservation.purpose}`
                      : "直近の予約なし"}
                  </p>
                </div>
                <div className="eventActions facilityActions">
                  <button
                    className="iconButton compact"
                    aria-label={`${facility.name}を編集`}
                    onClick={() => openEditForm(facility)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={15} />
                  </button>
                  <button
                    className="iconButton compact danger"
                    aria-label={`${facility.name}を削除`}
                    disabled={deletingId === facility.id}
                    onClick={() => void deleteFacility(facility)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel reservationApprovalPanel" aria-label="承認待ち予約">
          <div className="panelHeader compact">
            <div>
              <p className="sectionLabel">承認待ち</p>
              <h2>施設予約</h2>
            </div>
            <CheckCircle2 aria-hidden="true" className="panelIcon" size={20} />
          </div>

          {facilityState.status === "loading" && !snapshot && (
            <EmptyState title="取得中" description="承認待ち予約を確認しています。" />
          )}

          {facilityState.status !== "loading" &&
            snapshot?.pendingReservations.length === 0 && (
              <EmptyState
                title="承認待ちなし"
                description="現在処理が必要な施設予約はありません。"
              />
            )}

          <div className="reservationApprovalList">
            {snapshot?.pendingReservations.map((reservation) => (
              <article className="reservationApprovalItem" key={reservation.id}>
                <div>
                  <div className="facilityAdminHeader">
                    <h3>{reservation.purpose}</h3>
                    <span className="statusPill wait">
                      {reservation.statusLabel}
                    </span>
                  </div>
                  <p>
                    {reservation.facility.name} /{" "}
                    {formatDateTime(reservation.startsAt)}-
                    {formatTime(reservation.endsAt)}
                  </p>
                  <span className="facilityMeta">
                    {reservation.event?.title ?? "予定なし"}
                  </span>
                </div>
                <div className="reservationDecisionActions">
                  <button
                    className="textButton primary"
                    disabled={decidingReservationId === reservation.id}
                    onClick={() =>
                      void decideReservation(reservation.id, "APPROVED")
                    }
                    type="button"
                  >
                    <CheckCircle2 aria-hidden="true" size={16} />
                    承認
                  </button>
                  <button
                    className="textButton"
                    disabled={decidingReservationId === reservation.id}
                    onClick={() =>
                      void decideReservation(reservation.id, "REJECTED")
                    }
                    type="button"
                  >
                    <CircleX aria-hidden="true" size={16} />
                    却下
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function getFacilityStats(facilities: FacilitySummary[]) {
  return facilities.reduce(
    (result, facility) => ({
      total: result.total + 1,
      available:
        facility.status === "AVAILABLE" ? result.available + 1 : result.available,
    }),
    {
      available: 0,
      total: 0,
    },
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
