export type ScheduleRange = "today" | "week" | "month";

export type ScheduleOption = {
  id: string;
  name: string;
};

export type FacilityScheduleSummary = {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  tone: "open" | "busy" | "wait";
  capacity: number | null;
  location: string | null;
  organizationUnitName: string | null;
  nextReservation: {
    startsAt: string;
    endsAt: string;
    purpose: string;
    status: string;
    statusLabel: string;
  } | null;
};

export type ScheduleEventSummary = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  visibility: "PRIVATE" | "ORGANIZATION" | "TENANT";
  organizationUnit: ScheduleOption | null;
  createdBy: ScheduleOption;
  reservation: {
    id: string;
    status: string;
    statusLabel: string;
    facility: {
      id: string;
      name: string;
      status: string;
      capacity: number | null;
      location: string | null;
    };
  } | null;
};

export type ScheduleSnapshot = {
  tenant: {
    code: string;
    name: string;
    timezone: string;
  };
  range: ScheduleRange;
  rangeStart: string;
  rangeEnd: string;
  events: ScheduleEventSummary[];
  facilities: FacilityScheduleSummary[];
  organizationUnits: ScheduleOption[];
  users: ScheduleOption[];
};

export type ScheduleEventInput = {
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  visibility: "PRIVATE" | "ORGANIZATION" | "TENANT";
  organizationUnitId: string | null;
  facilityId: string | null;
};

export type ScheduleApiResponse =
  | {
      data: ScheduleSnapshot;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type ScheduleEventMutationResponse =
  | {
      data: ScheduleEventSummary;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };
