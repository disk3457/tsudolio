import type {
  ScheduleEventInput,
  ScheduleEventSummary,
  ScheduleRange,
  ScheduleSnapshot,
} from "@/application/schedule/types";

export type ScheduleRepository = {
  getScheduleSnapshot: (
    range: ScheduleRange,
    tenantCode?: string,
  ) => Promise<ScheduleSnapshot>;
  createScheduleEvent: (
    input: ScheduleEventInput,
    tenantCode?: string,
  ) => Promise<ScheduleEventSummary>;
  updateScheduleEvent: (
    eventId: string,
    input: ScheduleEventInput,
    tenantCode?: string,
  ) => Promise<ScheduleEventSummary>;
  deleteScheduleEvent: (eventId: string, tenantCode?: string) => Promise<void>;
};

export function createScheduleUseCases(repository: ScheduleRepository) {
  return {
    getScheduleSnapshot: repository.getScheduleSnapshot,
    createScheduleEvent: repository.createScheduleEvent,
    updateScheduleEvent: repository.updateScheduleEvent,
    deleteScheduleEvent: repository.deleteScheduleEvent,
  };
}
