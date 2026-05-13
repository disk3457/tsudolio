import { createOrganizationUseCases } from "@/application/organization/use-cases";
import { parseUserInput } from "@/application/organization/organization-validation";
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
    userId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const input = parseUserInput(
      await readRequestJson(request, "利用者データのJSONを読み取れませんでした。"),
    );
    const user = await organizationUseCases.updateUser(userId, input);

    return dataResponse(user);
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const result = await organizationUseCases.deleteOrSuspendUser(userId);

    return dataResponse(result);
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

function organizationErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "ORGANIZATION_DATA_UNAVAILABLE",
    "利用者データを処理できませんでした。",
  );
}
