import { createScheduleUseCases } from "@/application/schedule/use-cases";
import {
  parseScheduleEventInput,
  parseScheduleRange,
} from "@/application/schedule/schedule-validation";
import { prismaScheduleRepository } from "@/infrastructure/prisma/schedule-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scheduleUseCases = createScheduleUseCases(prismaScheduleRepository);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const range = parseScheduleRange(url.searchParams.get("range"));
    const snapshot = await scheduleUseCases.getScheduleSnapshot(range);

    return dataResponse(snapshot);
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = parseScheduleEventInput(
      await readRequestJson(request, "予定データのJSONを読み取れませんでした。"),
    );
    const event = await scheduleUseCases.createScheduleEvent(input);

    return dataResponse(event, 201);
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
