import { createFacilityUseCases } from "@/application/facilities/use-cases";
import { parseFacilityReservationDecisionInput } from "@/application/facilities/facility-validation";
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
    reservationId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const mutationContext = await requireMutationContext(
      request,
      permissions.manageSchedule,
    );
    const { reservationId } = await context.params;
    const input = parseFacilityReservationDecisionInput(
      await readRequestJson(
        request,
        "予約ステータスのJSONを読み取れませんでした。",
      ),
    );
    const reservation =
      await facilityUseCases.updateFacilityReservationStatus(
        reservationId,
        input,
        mutationContext,
      );

    return dataResponse(reservation);
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
