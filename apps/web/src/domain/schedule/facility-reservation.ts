export type ReservationWorkflowStatus = "PENDING" | "APPROVED";

export function reservationWorkflowStatusForFacility(
  status: string,
): ReservationWorkflowStatus {
  return status === "APPROVAL_REQUIRED" ? "PENDING" : "APPROVED";
}
