import type {
  ScheduleEventInput,
  ScheduleEventSummary,
  ScheduleRange,
  ScheduleSnapshot,
} from "@/application/schedule/types";
import type { MutationContext } from "@/application/security/types";

export type ScheduleRepository = {
  getScheduleSnapshot: (
    range: ScheduleRange,
    tenantCode?: string,
  ) => Promise<ScheduleSnapshot>;
  createScheduleEvent: (
    input: ScheduleEventInput,
    context: MutationContext,
  ) => Promise<ScheduleEventSummary>;
  updateScheduleEvent: (
    eventId: string,
    input: ScheduleEventInput,
    context: MutationContext,
  ) => Promise<ScheduleEventSummary>;
  deleteScheduleEvent: (
    eventId: string,
    context: MutationContext,
  ) => Promise<void>;
};

export function createScheduleUseCases(repository: ScheduleRepository) {
  return {
    getScheduleSnapshot: repository.getScheduleSnapshot,
    createScheduleEvent: repository.createScheduleEvent,
    updateScheduleEvent: repository.updateScheduleEvent,
    deleteScheduleEvent: repository.deleteScheduleEvent,
  };
}
