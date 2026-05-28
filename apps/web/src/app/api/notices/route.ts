import { parseNoticeInput } from "@/application/notices/notice-validation";
import { createNoticeUseCases } from "@/application/notices/use-cases";
import { permissions } from "@/application/security/permissions";
import {
  getCurrentUserFromRequest,
  requireMutationContext,
} from "@/app/api/_shared/request-context";
import { prismaNoticeRepository } from "@/infrastructure/prisma/notice-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noticeUseCases = createNoticeUseCases(prismaNoticeRepository);

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const snapshot =
      await noticeUseCases.getNoticeCenterSnapshot(currentUser);

    return dataResponse(snapshot);
  } catch (error) {
    return noticeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireMutationContext(
      request,
      permissions.manageNotices,
    );
    const input = parseNoticeInput(
      await readRequestJson(request, "掲示データのJSONを読み取れませんでした。"),
    );
    const notice = await noticeUseCases.createNotice(input, context);

    return dataResponse(notice, 201);
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
