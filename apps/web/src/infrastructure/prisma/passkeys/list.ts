import type {
  CurrentUserContext,
  PasskeySummary,
} from "@/application/security/types";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import {
  passkeySummarySelect,
  toPasskeySummary,
} from "@/infrastructure/prisma/passkeys/shared";

export async function listPasskeys(
  currentUser: CurrentUserContext,
): Promise<{ passkeys: PasskeySummary[] }> {
  const passkeys = await prisma.webAuthnCredential.findMany({
    where: {
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: passkeySummarySelect,
  });

  return {
    passkeys: passkeys.map(toPasskeySummary),
  };
}
