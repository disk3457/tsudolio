import type {
  FacilityInput,
  FacilityReservationDecisionInput,
  FacilityReservationSummary,
  FacilitySnapshot,
  FacilitySummary,
} from "@/application/facilities/types";
import type { MutationContext } from "@/application/security/types";

export type FacilityRepository = {
  getFacilitySnapshot: (tenantCode: string) => Promise<FacilitySnapshot>;
  createFacility: (
    input: FacilityInput,
    context: MutationContext,
  ) => Promise<FacilitySummary>;
  updateFacility: (
    facilityId: string,
    input: FacilityInput,
    context: MutationContext,
  ) => Promise<FacilitySummary>;
  deleteFacility: (
    facilityId: string,
    context: MutationContext,
  ) => Promise<void>;
  updateFacilityReservationStatus: (
    reservationId: string,
    input: FacilityReservationDecisionInput,
    context: MutationContext,
  ) => Promise<FacilityReservationSummary>;
};

export function createFacilityUseCases(repository: FacilityRepository) {
  return {
    getFacilitySnapshot: repository.getFacilitySnapshot,
    createFacility: repository.createFacility,
    updateFacility: repository.updateFacility,
    deleteFacility: repository.deleteFacility,
    updateFacilityReservationStatus:
      repository.updateFacilityReservationStatus,
  };
}
