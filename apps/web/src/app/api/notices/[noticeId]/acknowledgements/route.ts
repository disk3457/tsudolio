import { createNoticeUseCases } from "@/application/notices/use-cases";
import { toMutationContext } from "@/application/security/permissions";
import {
  getClientIpAddress,
  getCurrentUserFromRequest,
} from "@/app/api/_shared/request-context";
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
    noticeId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const { noticeId } = await context.params;
    const notice = await noticeUseCases.acknowledgeNotice(
      noticeId,
      currentUser,
      toMutationContext(currentUser, {
        ipAddress: getClientIpAddress(request),
      }),
    );

    return dataResponse(notice);
  } catch (error) {
    return noticeErrorResponse(error);
  }
}

function noticeErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "NOTICE_DATA_UNAVAILABLE",
    "掲示データを処理できませんでした。",
  );
}
