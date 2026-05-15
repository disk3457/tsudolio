import { NextResponse } from "next/server";
import {
  getAuthSessionCookieName,
  getExpiredAuthSessionCookieOptions,
} from "@/infrastructure/auth/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    data: {
      status: "signed_out",
    },
    source: "auth",
  });

  response.cookies.set(
    getAuthSessionCookieName(),
    "",
    getExpiredAuthSessionCookieOptions(),
  );

  return response;
}
