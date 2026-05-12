import { NextResponse } from "next/server";
import {
  deleteScheduleEvent,
  ScheduleDataError,
  updateScheduleEvent,
} from "@/features/schedule/server/schedule-data";
import { parseScheduleEventInput } from "@/features/schedule/server/schedule-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const input = parseScheduleEventInput(await readJson(request));
    const event = await updateScheduleEvent(eventId, input);

    return NextResponse.json({
      data: event,
      source: "database",
    });
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    await deleteScheduleEvent(eventId);

    return NextResponse.json({
      data: {
        id: eventId,
        deleted: true,
      },
      source: "database",
    });
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ScheduleDataError(
      "INVALID_JSON",
      "予定データのJSONを読み取れませんでした。",
    );
  }
}

function scheduleErrorResponse(error: unknown) {
  if (error instanceof ScheduleDataError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  const message =
    error instanceof Error ? error.message : "予定データを処理できませんでした。";

  return NextResponse.json(
    {
      error: "SCHEDULE_DATA_UNAVAILABLE",
      message,
    },
    {
      status: 503,
    },
  );
}
