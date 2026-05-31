import { ApplicationError } from "@/application/shared/application-error";

export class NoticeApplicationError extends ApplicationError {
  constructor(code: string, message: string, status = 400) {
    super(code, message, status);
  }
}
