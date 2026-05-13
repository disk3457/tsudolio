import {
  assertPermission,
  toMutationContext,
} from "@/application/security/permissions";
import type {
  CurrentUserContext,
  MutationContext,
  PermissionCode,
} from "@/application/security/types";
import { prismaCurrentUserRepository } from "@/infrastructure/prisma/current-user-repository";

const tenantHeader = "x-tsudolio-tenant-code";
const userEmailHeader = "x-tsudolio-user-email";

export function getTenantCodeFromRequest(request: Request) {
  return readHeader(request, tenantHeader);
}

export async function getCurrentUserFromRequest(request: Request) {
  return prismaCurrentUserRepository.resolveCurrentUser({
    tenantCode: getTenantCodeFromRequest(request),
    userEmail: readHeader(request, userEmailHeader),
  });
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
  return toMutationContext(await requirePermission(request, permission));
}

function readHeader(request: Request, name: string) {
  const value = request.headers.get(name)?.trim();
  return value ? value : null;
}

