import type {
  FacilityInput,
  FacilityStatusValue,
  FacilitySummary,
} from "@/application/facilities/types";

export type FacilityFormState = {
  id: string | null;
  code: string;
  name: string;
  status: FacilityStatusValue;
  capacity: string;
  location: string;
  organizationUnitId: string;
};

export function createDefaultFacilityFormState(): FacilityFormState {
  return {
    id: null,
    code: "",
    name: "",
    status: "AVAILABLE",
    capacity: "",
    location: "",
    organizationUnitId: "",
  };
}

export function facilityToFormState(
  facility: FacilitySummary,
): FacilityFormState {
  return {
    id: facility.id,
    code: facility.code,
    name: facility.name,
    status: facility.status,
    capacity: facility.capacity?.toString() ?? "",
    location: facility.location ?? "",
    organizationUnitId: facility.organizationUnit?.id ?? "",
  };
}

export function formStateToFacilityInput(
  formState: FacilityFormState,
): FacilityInput {
  return {
    code: formState.code,
    name: formState.name,
    status: formState.status,
    capacity: formState.capacity ? Number(formState.capacity) : null,
    location: formState.location || null,
    organizationUnitId: formState.organizationUnitId || null,
  };
}
