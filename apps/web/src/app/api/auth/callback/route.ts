import { NextResponse } from "next/server";
import {
  getOidcCookieNames,
  getOidcExpiredCookieOptions,
  validateOidcCallback,
} from "@/infrastructure/auth/oidc-provider";
import { applicationErrorResponse } from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const result = validateOidcCallback(request);
    const response = NextResponse.json(
      {
        data: {
          status: "accepted",
          next: result.next,
        },
        source: "oidc",
      },
      {
        status: 202,
      },
    );
    const cookieNames = getOidcCookieNames();
    const expiredCookieOptions = getOidcExpiredCookieOptions();

    response.cookies.set(cookieNames.state, "", expiredCookieOptions);
    response.cookies.set(cookieNames.nonce, "", expiredCookieOptions);
    response.cookies.set(cookieNames.verifier, "", expiredCookieOptions);

    return response;
  } catch (error) {
    return applicationErrorResponse(
      error,
      "OIDC_CALLBACK_UNAVAILABLE",
      "OIDC callback を処理できませんでした。",
    );
  }
}
