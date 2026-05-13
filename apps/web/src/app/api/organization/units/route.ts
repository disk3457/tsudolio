import { createOrganizationUseCases } from "@/application/organization/use-cases";
import { parseOrganizationUnitInput } from "@/application/organization/organization-validation";
import { prismaOrganizationRepository } from "@/infrastructure/prisma/organization-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";
import { requireMutationContext } from "@/app/api/_shared/request-context";
import { permissions } from "@/application/security/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const organizationUseCases = createOrganizationUseCases(
  prismaOrganizationRepository,
);

export async function POST(request: Request) {
  try {
    const context = await requireMutationContext(
      request,
      permissions.manageOrganization,
    );
    const input = parseOrganizationUnitInput(
      await readRequestJson(request, "組織データのJSONを読み取れませんでした。"),
    );
    const unit = await organizationUseCases.createOrganizationUnit(
      input,
      context,
    );

    return dataResponse(unit, 201);
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
