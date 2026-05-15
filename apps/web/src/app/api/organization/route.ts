import { createOrganizationUseCases } from "@/application/organization/use-cases";
import { prismaOrganizationRepository } from "@/infrastructure/prisma/organization-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";
import { getCurrentUserFromRequest } from "@/app/api/_shared/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const organizationUseCases = createOrganizationUseCases(
  prismaOrganizationRepository,
);

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const snapshot = await organizationUseCases.getOrganizationSnapshot(
      currentUser.tenantCode,
    );

    return dataResponse(snapshot);
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

function organizationErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "ORGANIZATION_DATA_UNAVAILABLE",
    "組織データを処理できませんでした。",
  );
}
