import { NextResponse } from "next/server";
import {
  createOidcAuthorizationUrl,
  getOidcCookieNames,
  getOidcCookieOptions,
} from "@/infrastructure/auth/oidc-provider";
import { applicationErrorResponse } from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { authorizationUrl, cookies } =
      await createOidcAuthorizationUrl(request);
    const response = NextResponse.redirect(authorizationUrl);
    const cookieNames = getOidcCookieNames();
    const cookieOptions = getOidcCookieOptions(request);

    response.cookies.set(cookieNames.state, cookies.state, cookieOptions);
    response.cookies.set(cookieNames.nonce, cookies.nonce, cookieOptions);
    response.cookies.set(cookieNames.verifier, cookies.verifier, cookieOptions);

    return response;
  } catch (error) {
    return applicationErrorResponse(
      error,
      "OIDC_LOGIN_UNAVAILABLE",
      "OIDC ログインを開始できませんでした。",
    );
  }
}
