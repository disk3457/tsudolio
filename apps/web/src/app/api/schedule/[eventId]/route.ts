import { createScheduleUseCases } from "@/application/schedule/use-cases";
import { parseScheduleEventInput } from "@/application/schedule/schedule-validation";
import { prismaScheduleRepository } from "@/infrastructure/prisma/schedule-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";
import { requireMutationContext } from "@/app/api/_shared/request-context";
import { permissions } from "@/application/security/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scheduleUseCases = createScheduleUseCases(prismaScheduleRepository);

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const mutationContext = await requireMutationContext(
      request,
      permissions.manageSchedule,
    );
    const { eventId } = await context.params;
    const input = parseScheduleEventInput(
      await readRequestJson(request, "予定データのJSONを読み取れませんでした。"),
    );
    const event = await scheduleUseCases.updateScheduleEvent(
      eventId,
      input,
      mutationContext,
    );

    return dataResponse(event);
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const mutationContext = await requireMutationContext(
      request,
      permissions.manageSchedule,
    );
    const { eventId } = await context.params;
    await scheduleUseCases.deleteScheduleEvent(eventId, mutationContext);

    return dataResponse({
      id: eventId,
      deleted: true,
    });
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}

function scheduleErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "SCHEDULE_DATA_UNAVAILABLE",
    "予定データを処理できませんでした。",
  );
}
