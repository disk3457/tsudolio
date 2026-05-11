"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { EmptyState } from "@/features/workspace/components/empty-state";
import type {
  DeleteMutationResponse,
  OrganizationApiResponse,
  OrganizationSnapshot,
  OrganizationUnitInput,
  OrganizationUnitKind,
  OrganizationUnitMutationResponse,
  OrganizationUnitSummary,
  UserInput,
  UserMutationResponse,
  UserSummary,
} from "@/lib/organization-types";

type OrganizationLoadState = {
  snapshot: OrganizationSnapshot | null;
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

type ActivePanel = "units" | "users";

type UnitFormState = {
  id: string | null;
  code: string;
  name: string;
  kind: OrganizationUnitKind;
  parentId: string;
  sortOrder: string;
};

type UserFormState = {
  id: string | null;
  email: string;
  displayName: string;
  kanaName: string;
  title: string;
  organizationUnitId: string;
  isSystemAdmin: boolean;
};

const kindOptions: Array<{ key: OrganizationUnitKind; label: string }> = [
  { key: "DEPARTMENT", label: "部署" },
  { key: "WARD", label: "病棟" },
  { key: "BRANCH", label: "支店" },
  { key: "TEAM", label: "チーム" },
  { key: "EXTERNAL_PARTNER", label: "外部連携" },
];

export function OrganizationView() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("units");
  const [organizationState, setOrganizationState] =
    useState<OrganizationLoadState>({
      snapshot: null,
      status: "loading",
      message: null,
      updatedAt: null,
    });
  const [unitForm, setUnitForm] = useState<UnitFormState | null>(null);
  const [userForm, setUserForm] = useState<UserFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadOrganization = useCallback(async (signal?: AbortSignal) => {
    setOrganizationState((current) => ({
      ...current,
      status: current.snapshot ? "ready" : "loading",
      message: null,
    }));

    try {
      const response = await fetch("/api/organization", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal,
      });
      const body = (await response.json()) as OrganizationApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "組織データを取得できませんでした",
        );
      }

      setOrganizationState({
        snapshot: body.data,
        status: "ready",
        message: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setOrganizationState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "組織データを取得できませんでした",
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadOrganization(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadOrganization]);

  const organizationUnits = useMemo(
    () => organizationState.snapshot?.organizationUnits ?? [],
    [organizationState.snapshot?.organizationUnits],
  );
  const users = useMemo(
    () => organizationState.snapshot?.users ?? [],
    [organizationState.snapshot?.users],
  );
  const activeUsers = useMemo(
    () =>
      users.filter((user) =>
        user.memberships.some((membership) => membership.status === "ACTIVE"),
      ),
    [users],
  );
  const formUnits = useMemo(
    () =>
      organizationUnits.filter(
        (unit) => !unitForm?.id || unit.id !== unitForm.id,
      ),
    [organizationUnits, unitForm?.id],
  );

  async function handleUnitSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!unitForm) {
      return;
    }

    setSaving(true);
    setOrganizationState((current) => ({ ...current, message: null }));

    try {
      const payload = unitFormToInput(unitForm);
      const response = await fetch(
        unitForm.id
          ? `/api/organization/units/${unitForm.id}`
          : "/api/organization/units",
        {
          method: unitForm.id ? "PATCH" : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as OrganizationUnitMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "組織を保存できませんでした",
        );
      }

      setUnitForm(null);
      await loadOrganization();
    } catch (error) {
      setOrganizationState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "組織を保存できませんでした",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function handleUserSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userForm) {
      return;
    }

    setSaving(true);
    setOrganizationState((current) => ({ ...current, message: null }));

    try {
      const payload = userFormToInput(userForm);
      const response = await fetch(
        userForm.id
          ? `/api/organization/users/${userForm.id}`
          : "/api/organization/users",
        {
          method: userForm.id ? "PATCH" : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as UserMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "利用者を保存できませんでした",
        );
      }

      setUserForm(null);
      await loadOrganization();
    } catch (error) {
      setOrganizationState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "利用者を保存できませんでした",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function handleUnitDelete(unit: OrganizationUnitSummary) {
    if (!window.confirm(`${unit.name} を削除しますか？`)) {
      return;
    }

    setDeletingId(unit.id);
    setOrganizationState((current) => ({ ...current, message: null }));

    try {
      const response = await fetch(`/api/organization/units/${unit.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });
      const body = (await response.json()) as DeleteMutationResponse;

      if (!response.ok || "error" in body) {
        throw new Error(
          "message" in body ? body.message : "組織を削除できませんでした",
        );
      }

      if (unitForm?.id === unit.id) {
        setUnitForm(null);
      }

      await loadOrganization();
    } catch (error) {
      setOrganizationState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "組織を削除できませんでした",
      }));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUserDelete(user: UserSummary) {
    if (!window.confirm(`${user.displayName} を利用停止または削除しますか？`)) {
      return;
    }

    setDeletingId(user.id);
    setOrganizationState((current) => ({ ...current, message: null }));

    try {
      const response = await fetch(`/api/organization/users/${user.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });
      const body = (await response.json()) as DeleteMutationResponse;

      if (!response.ok || "error" in body) {
        throw new Error(
          "message" in body ? body.message : "利用者を更新できませんでした",
        );
      }

      if (userForm?.id === user.id) {
        setUserForm(null);
      }

      await loadOrganization();
    } catch (error) {
      setOrganizationState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "利用者を更新できませんでした",
      }));
    } finally {
      setDeletingId(null);
    }
  }

  function openUnitForm(unit?: OrganizationUnitSummary) {
    setUserForm(null);
    setUnitForm(unit ? unitToFormState(unit) : createDefaultUnitFormState());
    setActivePanel("units");
  }

  function openUserForm(user?: UserSummary) {
    setUnitForm(null);
    setUserForm(user ? userToFormState(user) : createDefaultUserFormState());
    setActivePanel("users");
  }

  function updateUnitForm<Field extends keyof UnitFormState>(
    field: Field,
    value: UnitFormState[Field],
  ) {
    setUnitForm((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  function updateUserForm<Field extends keyof UserFormState>(
    field: Field,
    value: UserFormState[Field],
  ) {
    setUserForm((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  return (
    <section className="viewStack">
      <div className="viewToolbar" aria-label="組織操作">
        <div className="segmentedControl" aria-label="表示対象">
          <button
            className={activePanel === "units" ? "active" : ""}
            onClick={() => setActivePanel("units")}
            type="button"
          >
            組織
          </button>
          <button
            className={activePanel === "users" ? "active" : ""}
            onClick={() => setActivePanel("users")}
            type="button"
          >
            利用者
          </button>
        </div>
        <div className="toolbarActions">
          <button
            className="iconButton"
            aria-label="組織データを再読み込み"
            onClick={() => void loadOrganization()}
            type="button"
          >
            <RefreshCcw aria-hidden="true" size={18} />
          </button>
          <button
            className="textButton"
            onClick={() => openUnitForm()}
            type="button"
          >
            <Plus aria-hidden="true" size={17} />
            組織
          </button>
          <button
            className="textButton primary"
            onClick={() => openUserForm()}
            type="button"
          >
            <UserPlus aria-hidden="true" size={17} />
            利用者
          </button>
        </div>
      </div>

      {organizationState.message && (
        <div className="viewAlert" role="alert">
          <AlertCircle aria-hidden="true" size={18} />
          <p>{organizationState.message}</p>
        </div>
      )}

      {unitForm && (
        <form className="panel scheduleForm" onSubmit={handleUnitSubmit}>
          <div className="panelHeader compact">
            <div>
              <p className="sectionLabel">
                {unitForm.id ? "組織更新" : "新規組織"}
              </p>
              <h2>{unitForm.id ? "組織を編集" : "組織を登録"}</h2>
            </div>
            <button
              className="iconButton"
              aria-label="組織フォームを閉じる"
              onClick={() => setUnitForm(null)}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <div className="formGrid">
            <label className="fieldControl">
              <span>組織コード</span>
              <input
                maxLength={80}
                onChange={(event) => updateUnitForm("code", event.target.value)}
                required
                value={unitForm.code}
              />
            </label>
            <label className="fieldControl wide">
              <span>組織名</span>
              <input
                maxLength={160}
                onChange={(event) => updateUnitForm("name", event.target.value)}
                required
                value={unitForm.name}
              />
            </label>
            <label className="fieldControl">
              <span>表示順</span>
              <input
                min={0}
                onChange={(event) =>
                  updateUnitForm("sortOrder", event.target.value)
                }
                type="number"
                value={unitForm.sortOrder}
              />
            </label>
            <label className="fieldControl">
              <span>種別</span>
              <select
                onChange={(event) =>
                  updateUnitForm(
                    "kind",
                    event.target.value as OrganizationUnitKind,
                  )
                }
                value={unitForm.kind}
              >
                {kindOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldControl wide">
              <span>親組織</span>
              <select
                onChange={(event) =>
                  updateUnitForm("parentId", event.target.value)
                }
                value={unitForm.parentId}
              >
                <option value="">なし</option>
                {formUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <FormFooter
            disabled={saving}
            onCancel={() => setUnitForm(null)}
            saving={saving}
          />
        </form>
      )}

      {userForm && (
        <form className="panel scheduleForm" onSubmit={handleUserSubmit}>
          <div className="panelHeader compact">
            <div>
              <p className="sectionLabel">
                {userForm.id ? "利用者更新" : "新規利用者"}
              </p>
              <h2>{userForm.id ? "利用者を編集" : "利用者を登録"}</h2>
            </div>
            <button
              className="iconButton"
              aria-label="利用者フォームを閉じる"
              onClick={() => setUserForm(null)}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <div className="formGrid">
            <label className="fieldControl wide">
              <span>表示名</span>
              <input
                maxLength={120}
                onChange={(event) =>
                  updateUserForm("displayName", event.target.value)
                }
                required
                value={userForm.displayName}
              />
            </label>
            <label className="fieldControl wide">
              <span>メールアドレス</span>
              <input
                maxLength={254}
                onChange={(event) => updateUserForm("email", event.target.value)}
                required
                type="email"
                value={userForm.email}
              />
            </label>
            <label className="fieldControl">
              <span>カナ氏名</span>
              <input
                maxLength={120}
                onChange={(event) =>
                  updateUserForm("kanaName", event.target.value)
                }
                value={userForm.kanaName}
              />
            </label>
            <label className="fieldControl">
              <span>役職</span>
              <input
                maxLength={120}
                onChange={(event) => updateUserForm("title", event.target.value)}
                value={userForm.title}
              />
            </label>
            <label className="fieldControl wide">
              <span>所属組織</span>
              <select
                onChange={(event) =>
                  updateUserForm("organizationUnitId", event.target.value)
                }
                value={userForm.organizationUnitId}
              >
                <option value="">未指定</option>
                {organizationUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkControl">
              <input
                checked={userForm.isSystemAdmin}
                onChange={(event) =>
                  updateUserForm("isSystemAdmin", event.target.checked)
                }
                type="checkbox"
              />
              <span>システム管理者</span>
            </label>
          </div>
          <FormFooter
            disabled={saving}
            onCancel={() => setUserForm(null)}
            saving={saving}
          />
        </form>
      )}

      <section className="statusStrip organizationStats" aria-label="組織概要">
        <div>
          <p className="metricLabel">組織</p>
          <strong>{organizationUnits.length}</strong>
        </div>
        <div>
          <p className="metricLabel">有効利用者</p>
          <strong>{activeUsers.length}</strong>
        </div>
        <div>
          <p className="metricLabel">ロール</p>
          <strong>{organizationState.snapshot?.roles.length ?? 0}</strong>
        </div>
        <div>
          <p className="metricLabel">管理者</p>
          <strong>{users.filter((user) => user.isSystemAdmin).length}</strong>
        </div>
      </section>

      <section className="viewGrid">
        <section className="panel widePanel" aria-labelledby="org-heading">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">
                {activePanel === "units" ? "組織階層" : "利用者"}
              </p>
              <h2 id="org-heading">
                {activePanel === "units" ? "組織一覧" : "利用者一覧"}
              </h2>
            </div>
            {activePanel === "units" ? (
              <Building2 aria-hidden="true" className="panelIcon" size={21} />
            ) : (
              <UsersRound aria-hidden="true" className="panelIcon" size={21} />
            )}
          </div>

          {organizationState.status === "loading" && (
            <EmptyState title="取得中" description="組織データを確認しています。" />
          )}

          {organizationState.status !== "loading" &&
            activePanel === "units" &&
            organizationUnits.length === 0 && (
              <EmptyState
                title="組織なし"
                description="登録済みの組織はまだありません。"
              />
            )}

          {organizationState.status !== "loading" &&
            activePanel === "users" &&
            users.length === 0 && (
              <EmptyState
                title="利用者なし"
                description="登録済みの利用者はまだありません。"
              />
            )}

          {activePanel === "units" && organizationUnits.length > 0 && (
            <div className="orgGrid">
              {organizationUnits.map((unit) => (
                <article className="orgCard" key={unit.id}>
                  <div className="orgCardHeader">
                    <span>{unit.kindLabel}</span>
                    <strong>{unit.activeMemberCount}名</strong>
                  </div>
                  <h3>{unit.name}</h3>
                  <p>{unit.parentName ?? "最上位"} / {unit.code}</p>
                  <div className="orgCardMeta">
                    <span>配下 {unit.childCount}</span>
                    <span>施設 {unit.facilityCount}</span>
                    <span>表示順 {unit.sortOrder}</span>
                  </div>
                  <div className="chipList">
                    {unit.children.length > 0 ? (
                      unit.children.map((child) => (
                        <span key={child.id}>{child.name}</span>
                      ))
                    ) : (
                      <span>配下なし</span>
                    )}
                  </div>
                  <div className="eventActions">
                    <button
                      className="iconButton compact"
                      aria-label={`${unit.name}を編集`}
                      onClick={() => openUnitForm(unit)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={15} />
                    </button>
                    <button
                      className="iconButton compact danger"
                      aria-label={`${unit.name}を削除`}
                      disabled={
                        deletingId === unit.id ||
                        unit.childCount > 0 ||
                        unit.memberCount > 0 ||
                        unit.facilityCount > 0
                      }
                      onClick={() => void handleUnitDelete(unit)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {activePanel === "users" && users.length > 0 && (
            <div className="recordList">
              {users.map((user) => (
                <article className="recordItem userRecord" key={user.id}>
                  <div className="userRecordHeader">
                    <div>
                      <h3>{user.displayName}</h3>
                      <p>{user.email}</p>
                    </div>
                    {user.isSystemAdmin && (
                      <span className="statusPill wait">管理者</span>
                    )}
                  </div>
                  <strong>{user.title ?? "役職未設定"}</strong>
                  <div className="chipList compact">
                    {user.memberships.length > 0 ? (
                      user.memberships.map((membership) => (
                        <span key={membership.id}>
                          {membership.organizationUnitName} /{" "}
                          {membership.statusLabel}
                        </span>
                      ))
                    ) : (
                      <span>所属なし</span>
                    )}
                  </div>
                  <div className="eventActions">
                    <button
                      className="iconButton compact"
                      aria-label={`${user.displayName}を編集`}
                      onClick={() => openUserForm(user)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={15} />
                    </button>
                    <button
                      className="iconButton compact danger"
                      aria-label={`${user.displayName}を利用停止`}
                      disabled={deletingId === user.id}
                      onClick={() => void handleUserDelete(user)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel" aria-labelledby="role-heading">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">権限</p>
              <h2 id="role-heading">ロール</h2>
            </div>
            <KeyRound aria-hidden="true" className="panelIcon" size={21} />
          </div>
          <div className="recordList">
            {organizationState.snapshot?.roles.map((role) => (
              <article className="recordItem" key={role.id}>
                <div>
                  <h3>{role.name}</h3>
                  <p>{role.code}</p>
                </div>
                <strong>{role.assignmentCount}件</strong>
                <span>
                  {role.description ?? "説明未設定"} / 権限{" "}
                  {role.permissionCount}
                </span>
              </article>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}

function FormFooter({
  disabled,
  onCancel,
  saving,
}: {
  disabled: boolean;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="formFooter">
      <span />
      <div className="actionRow">
        <button className="textButton" onClick={onCancel} type="button">
          <X aria-hidden="true" size={16} />
          キャンセル
        </button>
        <button className="textButton primary" disabled={disabled} type="submit">
          <Save aria-hidden="true" size={16} />
          {saving ? "保存中" : "保存"}
        </button>
      </div>
    </div>
  );
}

function createDefaultUnitFormState(): UnitFormState {
  return {
    id: null,
    code: "",
    name: "",
    kind: "DEPARTMENT",
    parentId: "",
    sortOrder: "0",
  };
}

function createDefaultUserFormState(): UserFormState {
  return {
    id: null,
    email: "",
    displayName: "",
    kanaName: "",
    title: "",
    organizationUnitId: "",
    isSystemAdmin: false,
  };
}

function unitToFormState(unit: OrganizationUnitSummary): UnitFormState {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    kind: unit.kind,
    parentId: unit.parentId ?? "",
    sortOrder: String(unit.sortOrder),
  };
}

function userToFormState(user: UserSummary): UserFormState {
  const primaryMembership =
    user.memberships.find((membership) => membership.status === "ACTIVE") ??
    user.memberships[0] ??
    null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    kanaName: user.kanaName ?? "",
    title: user.title ?? "",
    organizationUnitId: primaryMembership?.organizationUnitId ?? "",
    isSystemAdmin: user.isSystemAdmin,
  };
}

function unitFormToInput(form: UnitFormState): OrganizationUnitInput {
  return {
    code: form.code,
    name: form.name,
    kind: form.kind,
    parentId: form.parentId || null,
    sortOrder: Number.parseInt(form.sortOrder || "0", 10),
  };
}

function userFormToInput(form: UserFormState): UserInput {
  return {
    email: form.email,
    displayName: form.displayName,
    kanaName: form.kanaName || null,
    title: form.title || null,
    organizationUnitId: form.organizationUnitId || null,
    isSystemAdmin: form.isSystemAdmin,
  };
}
