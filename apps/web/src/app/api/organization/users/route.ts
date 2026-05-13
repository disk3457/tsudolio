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

export async function POST(request: Request) {
  try {
    const input = parseUserInput(
      await readRequestJson(request, "利用者データのJSONを読み取れませんでした。"),
    );
    const user = await organizationUseCases.createUser(input);

    return dataResponse(user, 201);
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
