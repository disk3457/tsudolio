import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAuthSessionCookieName,
  readAuthSessionCookieValue,
} from "@/infrastructure/auth/session-cookie";
import { LoginView } from "@/presentation/features/auth/login-view";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const session = readAuthSessionCookieValue(
    cookieStore.get(getAuthSessionCookieName())?.value,
  );
  const params = await searchParams;
  const nextUrl = sanitizeNextUrl(params.next);

  if (session) {
    redirect(nextUrl);
  }

  return (
    <LoginView
      defaultTenantCode={process.env.TSUDOLIO_TENANT_CODE ?? ""}
      nextUrl={nextUrl}
    />
  );
}

function sanitizeNextUrl(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
