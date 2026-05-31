import { parseNoticeInput } from "@/application/notices/notice-validation";
import { createNoticeUseCases } from "@/application/notices/use-cases";
import { permissions } from "@/application/security/permissions";
import { requireMutationContext } from "@/app/api/_shared/request-context";
import { prismaNoticeRepository } from "@/infrastructure/prisma/notice-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noticeUseCases = createNoticeUseCases(prismaNoticeRepository);

type RouteContext = {
  params: Promise<{
    noticeId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const mutationContext = await requireMutationContext(
      request,
      permissions.manageNotices,
    );
    const { noticeId } = await context.params;
    const input = parseNoticeInput(
      await readRequestJson(request, "掲示データのJSONを読み取れませんでした。"),
    );
    const notice = await noticeUseCases.updateNotice(
      noticeId,
      input,
      mutationContext,
    );

    return dataResponse(notice);
  } catch (error) {
    return noticeErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const mutationContext = await requireMutationContext(
      request,
      permissions.manageNotices,
    );
    const { noticeId } = await context.params;
    await noticeUseCases.deleteNotice(noticeId, mutationContext);

    return dataResponse({
      id: noticeId,
      deleted: true,
    });
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
