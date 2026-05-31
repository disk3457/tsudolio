"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type {
  FacilityApiResponse,
  FacilityDeleteResponse,
  FacilityMutationResponse,
  FacilityReservationDecisionInput,
  FacilityReservationMutationResponse,
  FacilitySnapshot,
  FacilitySummary,
} from "@/application/facilities/types";
import {
  createDefaultFacilityFormState,
  facilityToFormState,
  formStateToFacilityInput,
  type FacilityFormState,
} from "@/presentation/features/facilities/form-state";

type FacilityLoadState = {
  snapshot: FacilitySnapshot | null;
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

export function useFacilityManagement() {
  const [facilityState, setFacilityState] = useState<FacilityLoadState>({
    snapshot: null,
    status: "loading",
    message: null,
    updatedAt: null,
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formState, setFormState] = useState<FacilityFormState>(() =>
    createDefaultFacilityFormState(),
  );
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [decidingReservationId, setDecidingReservationId] = useState<
    string | null
  >(null);

  const loadFacilities = useCallback(async (signal?: AbortSignal) => {
    setFacilityState((current) => ({
      ...current,
      status: current.snapshot ? "ready" : "loading",
      message: null,
    }));

    try {
      const response = await fetch("/api/facilities", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal,
      });
      const body = (await response.json()) as FacilityApiResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "施設データを取得できませんでした",
        );
      }

      setFacilityState({
        snapshot: body.data,
        status: "ready",
        message: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setFacilityState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "施設データを取得できませんでした",
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadFacilities(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadFacilities]);

  function openCreateForm() {
    setFormState(createDefaultFacilityFormState());
    setIsFormOpen(true);
  }

  function openEditForm(facility: FacilitySummary) {
    setFormState(facilityToFormState(facility));
    setIsFormOpen(true);
  }

  function closeForm() {
    setFormState(createDefaultFacilityFormState());
    setIsFormOpen(false);
  }

  function updateForm<Field extends keyof FacilityFormState>(
    field: Field,
    value: FacilityFormState[Field],
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitFacility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFacilityState((current) => ({
      ...current,
      message: null,
    }));

    try {
      const payload = formStateToFacilityInput(formState);
      const response = await fetch(
        formState.id ? `/api/facilities/${formState.id}` : "/api/facilities",
        {
          method: formState.id ? "PATCH" : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as FacilityMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "施設を保存できませんでした",
        );
      }

      closeForm();
      await loadFacilities();
    } catch (error) {
      setFacilityState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "施設を保存できませんでした",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function deleteFacility(facility: FacilitySummary) {
    if (!window.confirm(`${facility.name} を削除しますか？`)) {
      return;
    }

    setDeletingId(facility.id);
    setFacilityState((current) => ({
      ...current,
      message: null,
    }));

    try {
      const response = await fetch(`/api/facilities/${facility.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });
      const body = (await response.json()) as FacilityDeleteResponse;

      if (!response.ok || "error" in body) {
        throw new Error(
          "message" in body ? body.message : "施設を削除できませんでした",
        );
      }

      if (formState.id === facility.id) {
        closeForm();
      }

      await loadFacilities();
    } catch (error) {
      setFacilityState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "施設を削除できませんでした",
      }));
    } finally {
      setDeletingId(null);
    }
  }

  async function decideReservation(
    reservationId: string,
    status: FacilityReservationDecisionInput["status"],
  ) {
    setDecidingReservationId(reservationId);
    setFacilityState((current) => ({
      ...current,
      message: null,
    }));

    try {
      const response = await fetch(
        `/api/facilities/reservations/${reservationId}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );
      const body =
        (await response.json()) as FacilityReservationMutationResponse;

      if (!response.ok || !("data" in body)) {
        throw new Error(
          "message" in body ? body.message : "施設予約を更新できませんでした",
        );
      }

      await loadFacilities();
    } catch (error) {
      setFacilityState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "error",
        message:
          error instanceof Error ? error.message : "施設予約を更新できませんでした",
      }));
    } finally {
      setDecidingReservationId(null);
    }
  }

  return {
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
  };
}
