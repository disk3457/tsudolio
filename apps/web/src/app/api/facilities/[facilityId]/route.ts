import { createFacilityUseCases } from "@/application/facilities/use-cases";
import { parseFacilityInput } from "@/application/facilities/facility-validation";
import { permissions } from "@/application/security/permissions";
import { requireMutationContext } from "@/app/api/_shared/request-context";
import { prismaFacilityRepository } from "@/infrastructure/prisma/facility-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const facilityUseCases = createFacilityUseCases(prismaFacilityRepository);

type RouteContext = {
  params: Promise<{
    facilityId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const mutationContext = await requireMutationContext(
      request,
      permissions.manageSchedule,
    );
    const { facilityId } = await context.params;
    const input = parseFacilityInput(
      await readRequestJson(request, "施設データのJSONを読み取れませんでした。"),
    );
    const facility = await facilityUseCases.updateFacility(
      facilityId,
      input,
      mutationContext,
    );

    return dataResponse(facility);
  } catch (error) {
    return facilityErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const mutationContext = await requireMutationContext(
      request,
      permissions.manageSchedule,
    );
    const { facilityId } = await context.params;
    await facilityUseCases.deleteFacility(facilityId, mutationContext);

    return dataResponse({
      id: facilityId,
      deleted: true,
    });
  } catch (error) {
    return facilityErrorResponse(error);
  }
}

function facilityErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "FACILITY_DATA_UNAVAILABLE",
    "施設データを処理できませんでした。",
  );
}
