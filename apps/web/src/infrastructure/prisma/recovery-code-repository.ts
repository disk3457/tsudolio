import { ApplicationError } from "@/application/shared/application-error";
import type {
  CurrentUserContext,
  RecoveryCodeSummary,
} from "@/application/security/types";
import {
  createRecoveryCode,
  getRecoveryCodeSuffix,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "@/infrastructure/auth/recovery-code";
import { prismaAuthPolicyRepository } from "@/infrastructure/prisma/auth-policy-repository";
import {
  recordAuthAuditEvent,
  recordAuthAuditEventInTransaction,
} from "@/infrastructure/prisma/audit-event-repository";
import { resolveCurrentUser } from "@/infrastructure/prisma/current-user-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { Prisma } from "@generated/prisma/client";
import { AuditSeverity } from "@generated/prisma/enums";

const generatedRecoveryCodeCount = 10;
const normalizedRecoveryCodePattern = /^[2-9A-HJ-NP-Z]{16}$/;

export async function getRecoveryCodes(
  currentUser: CurrentUserContext,
): Promise<{ recoveryCodes: RecoveryCodeSummary }> {
  return {
    recoveryCodes: await buildRecoveryCodeSummary(currentUser),
  };
}

export async function generateRecoveryCodes(input: {
  currentUser: CurrentUserContext;
  ipAddress?: string | null;
}): Promise<{ codes: string[]; recoveryCodes: RecoveryCodeSummary }> {
  const passkeyCount = await prisma.webAuthnCredential.count({
    where: {
      tenantId: input.currentUser.tenantId,
      userId: input.currentUser.userId,
    },
  });

  if (passkeyCount === 0) {
    await recordAuthAuditEvent({
      tenantId: input.currentUser.tenantId,
      actorId: input.currentUser.userId,
      action: "リカバリーコード発行拒否",
      targetType: "user",
      targetId: input.currentUser.userId,
      severity: AuditSeverity.WARNING,
      ipAddress: input.ipAddress ?? null,
      metadata: createRecoveryCodeAuditMetadata(
        "passkey_required",
        input.currentUser.email,
      ),
    });

    throw new ApplicationError(
      "RECOVERY_CODE_PASSKEY_REQUIRED",
      "リカバリーコードの発行前にPasskeyを登録してください。",
      409,
    );
  }

  const codes = Array.from(
    { length: generatedRecoveryCodeCount },
    createRecoveryCode,
  );
  const generatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const revokedCodes = await tx.recoveryCode.updateMany({
      where: {
        tenantId: input.currentUser.tenantId,
        userId: input.currentUser.userId,
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: generatedAt,
      },
    });
    await tx.recoveryCode.createMany({
      data: codes.map((code) => ({
        tenantId: input.currentUser.tenantId,
        userId: input.currentUser.userId,
        codeHash: hashRecoveryCode(code),
        codeSuffix: getRecoveryCodeSuffix(code),
      })),
    });
    await recordAuthAuditEventInTransaction(tx, {
      tenantId: input.currentUser.tenantId,
      actorId: input.currentUser.userId,
      action: "リカバリーコード発行",
      targetType: "user",
      targetId: input.currentUser.userId,
      severity: AuditSeverity.WARNING,
      ipAddress: input.ipAddress ?? null,
      metadata: createRecoveryCodeAuditMetadata(
        "generated",
        input.currentUser.email,
        {
          generatedCount: generatedRecoveryCodeCount,
          revokedCount: revokedCodes.count,
        },
      ),
    });
  });

  return {
    codes,
    recoveryCodes: await buildRecoveryCodeSummary(input.currentUser),
  };
}

export async function authenticateWithRecoveryCode(input: {
  tenantCode: string;
  email: string;
  code: string;
  ipAddress?: string | null;
}): Promise<CurrentUserContext> {
  const tenantCode = normalizeRequired(input.tenantCode, "テナントコード");
  const email = normalizeEmail(input.email);
  const code = normalizeRecoveryCode(input.code);

  if (!normalizedRecoveryCodePattern.test(code)) {
    throw invalidRecoveryCode();
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
    select: {
      code: true,
      id: true,
    },
  });

  if (!tenant) {
    throw invalidRecoveryCode();
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      tenantId: tenant.id,
    },
    select: {
      email: true,
      id: true,
    },
  });

  if (!user) {
    await recordRecoveryCodeLoginFailure({
      email,
      ipAddress: input.ipAddress,
      outcome: "unknown_user",
      tenantId: tenant.id,
    });
    throw invalidRecoveryCode();
  }

  const recoveryCode = await prisma.recoveryCode.findFirst({
    where: {
      codeHash: hashRecoveryCode(code),
      tenantId: tenant.id,
      userId: user.id,
    },
    select: {
      id: true,
      revokedAt: true,
      usedAt: true,
    },
  });

  if (!recoveryCode || recoveryCode.usedAt || recoveryCode.revokedAt) {
    await recordRecoveryCodeLoginFailure({
      email,
      ipAddress: input.ipAddress,
      outcome: recoveryCode?.usedAt
        ? "used_code"
        : recoveryCode?.revokedAt
          ? "revoked_code"
          : "invalid_code",
      tenantId: tenant.id,
      userId: user.id,
    });
    throw invalidRecoveryCode();
  }

  const currentUser = await resolveCurrentUser({
    tenantCode: tenant.code,
    userEmail: user.email,
  });
  await prismaAuthPolicyRepository.assertAuthPolicyAllowsLogin({
    currentUser,
    provider: "recovery_code",
    ipAddress: input.ipAddress ?? null,
  });

  const usedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const consumedCode = await tx.recoveryCode.updateMany({
      where: {
        id: recoveryCode.id,
        revokedAt: null,
        usedAt: null,
      },
      data: {
        usedAt,
      },
    });

    if (consumedCode.count !== 1) {
      throw invalidRecoveryCode();
    }

    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: usedAt,
      },
    });
    await recordAuthAuditEventInTransaction(tx, {
      tenantId: tenant.id,
      actorId: user.id,
      action: "ログイン成功",
      targetType: "user",
      targetId: user.id,
      severity: AuditSeverity.NOTICE,
      ipAddress: input.ipAddress ?? null,
      metadata: createRecoveryCodeAuditMetadata("success", email, {
        codeId: recoveryCode.id,
      }),
    });
  });

  return currentUser;
}

export const prismaRecoveryCodeRepository = {
  authenticateWithRecoveryCode,
  generateRecoveryCodes,
  getRecoveryCodes,
};

async function buildRecoveryCodeSummary(
  currentUser: CurrentUserContext,
): Promise<RecoveryCodeSummary> {
  const [activeCount, usedCount, revokedCount, generatedAggregate, usedAggregate] =
    await prisma.$transaction([
      prisma.recoveryCode.count({
        where: {
          tenantId: currentUser.tenantId,
          userId: currentUser.userId,
          usedAt: null,
          revokedAt: null,
        },
      }),
      prisma.recoveryCode.count({
        where: {
          tenantId: currentUser.tenantId,
          userId: currentUser.userId,
          usedAt: {
            not: null,
          },
        },
      }),
      prisma.recoveryCode.count({
        where: {
          tenantId: currentUser.tenantId,
          userId: currentUser.userId,
          usedAt: null,
          revokedAt: {
            not: null,
          },
        },
      }),
      prisma.recoveryCode.aggregate({
        where: {
          tenantId: currentUser.tenantId,
          userId: currentUser.userId,
        },
        _max: {
          createdAt: true,
        },
      }),
      prisma.recoveryCode.aggregate({
        where: {
          tenantId: currentUser.tenantId,
          userId: currentUser.userId,
          usedAt: {
            not: null,
          },
        },
        _max: {
          usedAt: true,
        },
      }),
    ]);

  return {
    activeCount,
    usedCount,
    revokedCount,
    lastGeneratedAt: generatedAggregate._max.createdAt?.toISOString() ?? null,
    lastUsedAt: usedAggregate._max.usedAt?.toISOString() ?? null,
  };
}

function recordRecoveryCodeLoginFailure(input: {
  email: string;
  ipAddress?: string | null;
  outcome: string;
  tenantId: string;
  userId?: string | null;
}) {
  return recordAuthAuditEvent({
    tenantId: input.tenantId,
    actorId: input.userId ?? undefined,
    action: "リカバリーコードログイン失敗",
    targetType: input.userId ? "user" : "auth_identity",
    targetId: input.userId ?? input.email,
    severity: AuditSeverity.WARNING,
    ipAddress: input.ipAddress ?? null,
    metadata: createRecoveryCodeAuditMetadata(input.outcome, input.email),
  });
}

function createRecoveryCodeAuditMetadata(
  outcome: string,
  email: string,
  extra: Prisma.InputJsonObject = {},
): Prisma.InputJsonObject {
  return {
    provider: "recovery_code",
    outcome,
    email,
    ...extra,
  };
}

function normalizeRequired(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new ApplicationError(
      "RECOVERY_CODE_LOGIN_INPUT_INVALID",
      `${label}を入力してください。`,
      400,
    );
  }

  return normalized;
}

function normalizeEmail(value: string) {
  const email = normalizeRequired(value, "メールアドレス").toLowerCase();

  if (!email.includes("@")) {
    throw new ApplicationError(
      "RECOVERY_CODE_LOGIN_INPUT_INVALID",
      "メールアドレスの形式を確認してください。",
      400,
    );
  }

  return email;
}

function invalidRecoveryCode() {
  return new ApplicationError(
    "RECOVERY_CODE_INVALID",
    "リカバリーコードが正しくありません。",
    401,
  );
}
