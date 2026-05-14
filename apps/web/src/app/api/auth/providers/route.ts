import { NextResponse } from "next/server";
import { getAuthProviderStatus } from "@/infrastructure/auth/oidc-provider";
import { applicationErrorResponse } from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json({
      data: getAuthProviderStatus(),
      source: "configuration",
    });
  } catch (error) {
    return applicationErrorResponse(
      error,
      "AUTH_PROVIDER_UNAVAILABLE",
      "認証プロバイダー情報を取得できませんでした。",
    );
  }
}
