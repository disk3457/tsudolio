"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  DeleteMutationResponse,
  OrganizationApiResponse,
  OrganizationUnitMutationResponse,
  OrganizationUnitSummary,
  UserMutationResponse,
  UserSummary,
} from "@/application/organization/types";
import {
  createDefaultUnitFormState,
  createDefaultUserFormState,
  unitFormToInput,
  unitToFormState,
  userFormToInput,
  userToFormState,
} from "./form-state";
import type {
  ActivePanel,
  OrganizationLoadState,
  UnitFormState,
  UserFormState,
} from "./view-types";

export function useOrganizationDirectory() {
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
  const roles = useMemo(
    () => organizationState.snapshot?.roles ?? [],
    [organizationState.snapshot?.roles],
  );
  const activeUsers = useMemo(
    () =>
      users.filter((user) =>
        user.memberships.some((membership) => membership.status === "ACTIVE"),
      ),
    [users],
  );
  const adminUsers = useMemo(
    () => users.filter((user) => user.isSystemAdmin),
    [users],
  );
  const formUnits = useMemo(
    () =>
      organizationUnits.filter(
        (unit) => !unitForm?.id || unit.id !== unitForm.id,
      ),
    [organizationUnits, unitForm?.id],
  );

  async function handleUnitSubmit(event: FormEvent<HTMLFormElement>) {
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

  async function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
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

  function closeUnitForm() {
    setUnitForm(null);
  }

  function closeUserForm() {
    setUserForm(null);
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

  return {
    activePanel,
    activeUsers,
    adminUsers,
    closeUnitForm,
    closeUserForm,
    deletingId,
    formUnits,
    handleUnitDelete,
    handleUnitSubmit,
    handleUserDelete,
    handleUserSubmit,
    loadOrganization,
    openUnitForm,
    openUserForm,
    organizationState,
    organizationUnits,
    roles,
    saving,
    setActivePanel,
    unitForm,
    updateUnitForm,
    updateUserForm,
    userForm,
    users,
  };
}
