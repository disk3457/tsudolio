import { NextResponse } from "next/server";
import {
  createScheduleEvent,
  getScheduleSnapshot,
  ScheduleDataError,
} from "@/lib/schedule-data";
import {
  parseScheduleEventInput,
  parseScheduleRange,
} from "@/lib/schedule-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const range = parseScheduleRange(url.searchParams.get("range"));
    const snapshot = await getScheduleSnapshot(range);

    return NextResponse.json({
      data: snapshot,
      source: "database",
    });
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = parseScheduleEventInput(await readJson(request));
    const event = await createScheduleEvent(input);

    return NextResponse.json(
      {
        data: event,
        source: "database",
      },
      {
        status: 201,
      },
    );
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
