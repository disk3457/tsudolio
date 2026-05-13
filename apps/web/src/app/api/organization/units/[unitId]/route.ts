import { createOrganizationUseCases } from "@/application/organization/use-cases";
import { parseOrganizationUnitInput } from "@/application/organization/organization-validation";
import { prismaOrganizationRepository } from "@/infrastructure/prisma/organization-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const organizationUseCases = createOrganizationUseCases(
  prismaOrganizationRepository,
);

type RouteContext = {
  params: Promise<{
    unitId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { unitId } = await context.params;
    const input = parseOrganizationUnitInput(
      await readRequestJson(request, "組織データのJSONを読み取れませんでした。"),
    );
    const unit = await organizationUseCases.updateOrganizationUnit(
      unitId,
      input,
    );

    return dataResponse(unit);
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { unitId } = await context.params;
    await organizationUseCases.deleteOrganizationUnit(unitId);

    return dataResponse({
      id: unitId,
      deleted: true,
    });
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
