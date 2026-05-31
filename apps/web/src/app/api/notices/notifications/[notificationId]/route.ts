import { createNoticeUseCases } from "@/application/notices/use-cases";
import { getCurrentUserFromRequest } from "@/app/api/_shared/request-context";
import { prismaNoticeRepository } from "@/infrastructure/prisma/notice-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noticeUseCases = createNoticeUseCases(prismaNoticeRepository);

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const { notificationId } = await context.params;
    const notification = await noticeUseCases.markNotificationRead(
      notificationId,
      currentUser,
    );

    return dataResponse(notification);
  } catch (error) {
    return notificationErrorResponse(error);
  }
}

function notificationErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "NOTIFICATION_DATA_UNAVAILABLE",
    "通知データを処理できませんでした。",
  );
}
