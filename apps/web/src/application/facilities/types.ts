export type FacilityStatusValue =
  | "AVAILABLE"
  | "IN_USE"
  | "MAINTENANCE"
  | "APPROVAL_REQUIRED";

export type FacilityStatusTone = "open" | "busy" | "wait";

export type FacilityOption = {
  id: string;
  name: string;
};

export type FacilitySummary = {
  id: string;
  code: string;
  name: string;
  status: FacilityStatusValue;
  statusLabel: string;
  tone: FacilityStatusTone;
  capacity: number | null;
  location: string | null;
  organizationUnit: FacilityOption | null;
  activeReservationCount: number;
  pendingReservationCount: number;
  nextReservation: {
    id: string;
    startsAt: string;
    endsAt: string;
    purpose: string;
    status: string;
    statusLabel: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type FacilityReservationSummary = {
  id: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
  status: string;
  statusLabel: string;
  facility: {
    id: string;
    name: string;
    status: FacilityStatusValue;
    statusLabel: string;
  };
  event: {
    id: string;
    title: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type FacilitySnapshot = {
  tenant: {
    code: string;
    name: string;
    timezone: string;
  };
  facilities: FacilitySummary[];
  pendingReservations: FacilityReservationSummary[];
  organizationUnits: FacilityOption[];
};

export type FacilityInput = {
  code: string;
  name: string;
  status: FacilityStatusValue;
  capacity: number | null;
  location: string | null;
  organizationUnitId: string | null;
};

export type FacilityReservationDecisionInput = {
  status: "APPROVED" | "REJECTED" | "CANCELED";
};

export type FacilityApiResponse =
  | {
      data: FacilitySnapshot;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type FacilityMutationResponse =
  | {
      data: FacilitySummary;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type FacilityDeleteResponse =
  | {
      data: {
        id: string;
        deleted: true;
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type FacilityReservationMutationResponse =
  | {
      data: FacilityReservationSummary;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };
