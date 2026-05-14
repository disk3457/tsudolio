import { ApplicationError } from "@/application/shared/application-error";
import type { CurrentUserContext } from "@/application/security/types";
import { verifyPassword } from "@/infrastructure/auth/password";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { resolveCurrentUser } from "@/infrastructure/prisma/current-user-repository";

const maxFailedAttempts = 5;
const lockMinutes = 15;

export type PasswordLoginInput = {
  tenantCode: string;
  email: string;
  password: string;
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
    throw invalidCredentials();
  }

  if (user.credential.lockedUntil && user.credential.lockedUntil > new Date()) {
    throw new ApplicationError(
      "LOGIN_LOCKED",
      "ログイン試行回数が上限に達しました。時間を置いて再度お試しください。",
      423,
    );
  }

  if (!(await verifyPassword(password, user.credential.passwordHash))) {
    await recordFailedLogin(
      user.credential.id,
      user.credential.failedAttempts,
    );
    throw invalidCredentials();
  }

  await prisma.$transaction([
    prisma.userCredential.update({
      where: {
        id: user.credential.id,
      },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    }),
  ]);

  return resolveCurrentUser({
    tenantCode: tenant.code,
    userEmail: user.email,
  });
}

export const prismaPasswordAuthRepository = {
  authenticateWithPassword,
};

async function recordFailedLogin(
  credentialId: string,
  currentFailedAttempts: number,
) {
  const failedAttempts = currentFailedAttempts + 1;
  const lockedUntil =
    failedAttempts >= maxFailedAttempts
      ? new Date(Date.now() + lockMinutes * 60 * 1000)
      : null;

  await prisma.userCredential.update({
    where: {
      id: credentialId,
    },
    data: {
      failedAttempts,
      lockedUntil,
    },
  });
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
