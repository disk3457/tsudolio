import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAuthSessionCookieName,
  readAuthSessionCookieValue,
} from "@/infrastructure/auth/session-cookie";
import { TsudolioWorkspace } from "@/presentation/features/workspace/tsudolio-workspace";

export default async function Home() {
  const cookieStore = await cookies();
  const session = readAuthSessionCookieValue(
    cookieStore.get(getAuthSessionCookieName())?.value,
  );

  if (!session) {
    redirect("/login?next=/");
  }

  return <TsudolioWorkspace />;
}
