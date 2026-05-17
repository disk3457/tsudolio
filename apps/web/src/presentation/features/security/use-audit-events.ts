"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuditEventApiResponse,
  AuditEventFilterState,
  AuditEventLoadState,
} from "@/application/audit/types";
import { defaultAuditEventFilters } from "@/application/audit/audit-query";

export function useAuditEvents() {
  const [filters, setFilters] = useState<AuditEventFilterState>(
    defaultAuditEventFilters,
  );
  const [auditState, setAuditState] = useState<AuditEventLoadState>({
    snapshot: null,
    status: "loading",
    message: null,
    updatedAt: null,
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const requestPath = useMemo(() => buildAuditRequestPath(filters), [filters]);

  const loadAuditEvents = useCallback(
    async (signal?: AbortSignal) => {
      setAuditState((current) => ({
        ...current,
        status: current.snapshot ? "ready" : "loading",
        message: null,
      }));

      try {
        const response = await fetch(requestPath, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal,
        });
        const body = (await response.json()) as AuditEventApiResponse;

        if (!response.ok || !("data" in body)) {
          throw new Error(
            "message" in body
              ? body.message
              : "監査イベントを取得できませんでした",
          );
        }

        setAuditState({
          snapshot: body.data,
          status: "ready",
          message: null,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setAuditState((current) => ({
          ...current,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "監査イベントを取得できませんでした",
        }));
      }
    },
    [requestPath],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadAuditEvents(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadAuditEvents]);

  const events = useMemo(
    () => auditState.snapshot?.events ?? [],
    [auditState.snapshot?.events],
  );

  useEffect(() => {
    if (events.length === 0) {
      if (selectedEventId) {
        setSelectedEventId(null);
      }
      return;
    }

    if (
      !selectedEventId ||
      !events.some((event) => event.id === selectedEventId)
    ) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  function updateFilter<Field extends keyof AuditEventFilterState>(
    field: Field,
    value: AuditEventFilterState[Field],
  ) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetFilters() {
    setFilters(defaultAuditEventFilters);
  }

  return {
    auditState,
    filters,
    loadAuditEvents,
    resetFilters,
    selectedEvent,
    selectedEventId,
    setSelectedEventId,
    updateFilter,
  };
}

function buildAuditRequestPath(filters: AuditEventFilterState) {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set("query", filters.query);
  }

  if (filters.severity !== "all") {
    params.set("severity", filters.severity);
  }

  if (filters.targetType !== "all") {
    params.set("targetType", filters.targetType);
  }

  if (filters.action !== "all") {
    params.set("action", filters.action);
  }

  if (filters.range !== defaultAuditEventFilters.range) {
    params.set("range", filters.range);
  }

  params.set("limit", String(filters.limit));

  return `/api/security/audit-events?${params.toString()}`;
}
