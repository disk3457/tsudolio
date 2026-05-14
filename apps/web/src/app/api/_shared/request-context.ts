import {
  assertPermission,
  toMutationContext,
} from "@/application/security/permissions";
import type {
  CurrentUserContext,
  CurrentUserLookup,
  MutationContext,
  PermissionCode,
} from "@/application/security/types";
import { ApplicationError } from "@/application/shared/application-error";
import { readAuthSessionFromRequest } from "@/infrastructure/auth/session-cookie";
import { prismaCurrentUserRepository } from "@/infrastructure/prisma/current-user-repository";

export async function getCurrentUserFromRequest(request: Request) {
  return prismaCurrentUserRepository.resolveCurrentUser(
    getCurrentUserLookupFromRequest(request),
  );
}

export function getCurrentUserLookupFromRequest(
  request: Request,
): CurrentUserLookup {
  const session = readAuthSessionFromRequest(request);

  if (!session) {
    throw new ApplicationError(
      "AUTHENTICATION_REQUIRED",
      "ログインしてください。",
      401,
    );
  }

  return {
    tenantCode: session.tenantCode,
    userEmail: session.userEmail,
  };
}

export async function requirePermission(
  request: Request,
  permission: PermissionCode,
): Promise<CurrentUserContext> {
  const currentUser = await getCurrentUserFromRequest(request);
  assertPermission(currentUser, permission);

  return currentUser;
}

export async function requireMutationContext(
  request: Request,
  permission: PermissionCode,
): Promise<MutationContext> {
  return toMutationContext(await requirePermission(request, permission), {
    ipAddress: getClientIpAddress(request),
  });
}

function readHeader(request: Request, name: string) {
  const value = request.headers.get(name)?.trim();
  return value ? value : null;
}

export function getClientIpAddress(request: Request) {
  const forwardedFor = readHeader(request, "x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    readHeader(request, "x-real-ip") ??
    readHeader(request, "cf-connecting-ip")
  );
}
