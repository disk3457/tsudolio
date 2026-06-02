import { ApplicationError } from "@/application/shared/application-error";

export class WorkflowApplicationError extends ApplicationError {
  constructor(code: string, message: string, status = 400) {
    super(code, message, status);
    this.name = "WorkflowApplicationError";
  }
}
