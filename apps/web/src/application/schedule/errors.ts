import { ApplicationError } from "@/application/shared/application-error";

export class ScheduleApplicationError extends ApplicationError {
  constructor(code: string, message: string, status = 400) {
    super(code, message, status);
    this.name = "ScheduleApplicationError";
  }
}
