import { ApplicationError } from "@/application/shared/application-error";
import type { CurrentUserContext } from "@/application/security/types";
import { verifyPassword } from "@/infrastructure/auth/password";
import {
  recordAuthAuditEvent,
  recordAuthAuditEventInTransaction,
} from "@/infrastructure/prisma/audit-event-repository";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { resolveCurrentUser } from "@/infrastructure/prisma/current-user-repository";
import type { Prisma } from "@generated/prisma/client";
import { AuditSeverity } from "@generated/prisma/enums";

const maxFailedAttempts = 5;
const lockMinutes = 15;

export type PasswordLoginInput = {
  tenantCode: string;
  email: string;
  password: string;
  ipAddress?: string | null;
};

export async function authenticateWithPassword(
  input: PasswordLoginInput,
): Promise<CurrentUserContext> {
  const tenantCode = normalizeRequired(input.tenantCode, "テナントコード");
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!password) {
    throw invalidCredentials();
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (!tenant) {
    throw invalidCredentials();
  }

  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      email,
    },
    select: {
      id: true,
      email: true,
      credential: {
        select: {
          id: true,
          passwordHash: true,
          failedAttempts: true,
          lockedUntil: true,
        },
      },
    },
  });

  if (!user?.credential) {
    await recordAuthAuditEvent({
      tenantId: tenant.id,
      action: "ログイン失敗",
      targetType: "auth_identity",
      targetId: email,
      severity: AuditSeverity.WARNING,
      ipAddress: input.ipAddress ?? null,
      metadata: createPasswordAuditMetadata("unknown_user", email),
    });

    throw invalidCredentials();
  }

  const credential = user.credential;

  if (credential.lockedUntil && credential.lockedUntil > new Date()) {
    await recordAuthAuditEvent({
      tenantId: tenant.id,
      actorId: user.id,
      action: "ログイン拒否",
      targetType: "user",
      targetId: user.id,
      severity: AuditSeverity.WARNING,
      ipAddress: input.ipAddress ?? null,
      metadata: createPasswordAuditMetadata("locked", email, {
        lockedUntil: credential.lockedUntil.toISOString(),
      }),
    });

    throw new ApplicationError(
      "LOGIN_LOCKED",
      "ログイン試行回数が上限に達しました。時間を置いて再度お試しください。",
      423,
    );
  }

  if (!(await verifyPassword(password, credential.passwordHash))) {
    const failedLogin = createFailedLoginUpdate(credential.failedAttempts);

    await prisma.$transaction(async (tx) => {
      await tx.userCredential.update({
        where: {
          id: credential.id,
        },
        data: {
          failedAttempts: failedLogin.failedAttempts,
          lockedUntil: failedLogin.lockedUntil,
        },
      });
      await recordAuthAuditEventInTransaction(tx, {
        tenantId: tenant.id,
        actorId: user.id,
        action: "ログイン失敗",
        targetType: "user",
        targetId: user.id,
        severity: AuditSeverity.WARNING,
        ipAddress: input.ipAddress ?? null,
        metadata: createPasswordAuditMetadata("invalid_password", email, {
          failedAttempts: failedLogin.failedAttempts,
          ...(failedLogin.lockedUntil
            ? {
                lockedUntil: failedLogin.lockedUntil.toISOString(),
              }
            : {}),
        }),
      });
    });

    throw invalidCredentials();
  }

  await prisma.$transaction(async (tx) => {
    await tx.userCredential.update({
      where: {
        id: credential.id,
      },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
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
      metadata: createPasswordAuditMetadata("success", email),
    });
  });

  return resolveCurrentUser({
    tenantCode: tenant.code,
    userEmail: user.email,
  });
}

export const prismaPasswordAuthRepository = {
  authenticateWithPassword,
};

function createFailedLoginUpdate(currentFailedAttempts: number) {
  const failedAttempts = currentFailedAttempts + 1;
  const lockedUntil =
    failedAttempts >= maxFailedAttempts
      ? new Date(Date.now() + lockMinutes * 60 * 1000)
      : null;

  return {
    failedAttempts,
    lockedUntil,
  };
}

function createPasswordAuditMetadata(
  outcome: string,
  email: string,
  extra: Prisma.InputJsonObject = {},
): Prisma.InputJsonObject {
  return {
    provider: "password",
    outcome,
    email,
    ...extra,
  };
}

function normalizeRequired(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new ApplicationError(
      "LOGIN_INPUT_INVALID",
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
      "LOGIN_INPUT_INVALID",
      "メールアドレスの形式を確認してください。",
      400,
    );
  }

  return email;
}

function invalidCredentials() {
  return new ApplicationError(
    "INVALID_CREDENTIALS",
    "メールアドレスまたはパスワードが正しくありません。",
    401,
  );
}
