import { createFacilityUseCases } from "@/application/facilities/use-cases";
import { parseFacilityInput } from "@/application/facilities/facility-validation";
import { permissions } from "@/application/security/permissions";
import {
  getCurrentUserFromRequest,
  requireMutationContext,
} from "@/app/api/_shared/request-context";
import { prismaFacilityRepository } from "@/infrastructure/prisma/facility-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const facilityUseCases = createFacilityUseCases(prismaFacilityRepository);

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const snapshot = await facilityUseCases.getFacilitySnapshot(
      currentUser.tenantCode,
    );

    return dataResponse(snapshot);
  } catch (error) {
    return facilityErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireMutationContext(
      request,
      permissions.manageSchedule,
    );
    const input = parseFacilityInput(
      await readRequestJson(request, "施設データのJSONを読み取れませんでした。"),
    );
    const facility = await facilityUseCases.createFacility(input, context);

    return dataResponse(facility, 201);
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
