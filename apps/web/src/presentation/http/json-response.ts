import { NextResponse } from "next/server";
import { ApplicationError } from "@/application/shared/application-error";

export function dataResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      data,
      source: "database",
    },
    {
      status,
    },
  );
}

export async function readRequestJson(
  request: Request,
  invalidJsonMessage: string,
) {
  try {
    return await request.json();
  } catch {
    throw new ApplicationError("INVALID_JSON", invalidJsonMessage);
  }
}

export function applicationErrorResponse(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
) {
  if (error instanceof ApplicationError) {
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

  const message = error instanceof Error ? error.message : fallbackMessage;

  return NextResponse.json(
    {
      error: fallbackCode,
      message,
    },
    {
      status: 503,
    },
  );
}
