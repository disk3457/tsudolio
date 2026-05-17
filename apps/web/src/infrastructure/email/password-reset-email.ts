import { ApplicationError } from "@/application/shared/application-error";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const defaultLocalSmtpHost = "127.0.0.1";
const defaultLocalSmtpPort = 1025;
const defaultLocalSender = "Tsudolio <no-reply@tsudolio.local>";

type PasswordResetEmailInput = {
  recipientEmail: string;
  recipientName: string;
  tenantName: string;
  resetUrl: string;
  expiresAt: Date;
};

export type PasswordResetEmailDelivery = {
  status: "sent" | "skipped";
  messageId?: string;
  reason?: string;
};

type MailConfig = {
  from: string;
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  password: string | null;
};

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
): Promise<PasswordResetEmailDelivery> {
  const config = resolveMailConfig();

  if (!config) {
    if (isProduction()) {
      throw new ApplicationError(
        "PASSWORD_RESET_EMAIL_NOT_CONFIGURED",
        "パスワードリセットメールの送信設定が未設定です。",
        503,
      );
    }

    return {
      status: "skipped",
      reason: "not_configured",
    };
  }

  try {
    const transportOptions: SMTPTransport.Options = {
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user && config.password
        ? {
            auth: {
              pass: config.password,
              user: config.user,
            },
          }
        : {}),
    };
    const transport = nodemailer.createTransport(transportOptions);
    const result = await transport.sendMail({
      from: config.from,
      html: createPasswordResetHtml(input),
      subject: `[Tsudolio] パスワードリセットのご案内`,
      text: createPasswordResetText(input),
      to: input.recipientEmail,
    });

    return {
      status: "sent",
      messageId:
        typeof result.messageId === "string" ? result.messageId : undefined,
    };
  } catch (error) {
    if (isProduction()) {
      throw new ApplicationError(
        "PASSWORD_RESET_EMAIL_FAILED",
        "パスワードリセットメールを送信できませんでした。",
        503,
      );
    }

    return {
      status: "skipped",
      reason: createFailureReason(error),
    };
  }
}

function resolveMailConfig(): MailConfig | null {
  const host =
    readOptionalEnv("MAIL_SMTP_HOST") ??
    (isProduction() ? null : defaultLocalSmtpHost);
  const from =
    readOptionalEnv("MAIL_FROM") ?? (isProduction() ? null : defaultLocalSender);

  if (!host || !from) {
    return null;
  }

  const port =
    readOptionalIntegerEnv("MAIL_SMTP_PORT") ??
    (isProduction() ? 587 : defaultLocalSmtpPort);

  return {
    from,
    host,
    port,
    secure: readOptionalBooleanEnv("MAIL_SMTP_SECURE") ?? port === 465,
    user: readOptionalEnv("MAIL_SMTP_USER"),
    password: readOptionalEnv("MAIL_SMTP_PASSWORD"),
  };
}

function createPasswordResetText(input: PasswordResetEmailInput) {
  return [
    `${input.recipientName} 様`,
    "",
    `${input.tenantName} のTsudolioアカウントについて、パスワードリセット申請を受け付けました。`,
    `以下のリンクを${formatExpiration(input.expiresAt)}までに開いて、新しいパスワードを設定してください。`,
    "",
    input.resetUrl,
    "",
    "この申請に心当たりがない場合は、このメールを破棄してください。",
  ].join("\n");
}

function createPasswordResetHtml(input: PasswordResetEmailInput) {
  const resetUrl = escapeHtml(input.resetUrl);

  return [
    "<!doctype html>",
    '<html lang="ja">',
    "<body>",
    `<p>${escapeHtml(input.recipientName)} 様</p>`,
    `<p>${escapeHtml(input.tenantName)} のTsudolioアカウントについて、パスワードリセット申請を受け付けました。</p>`,
    `<p>以下のリンクを${escapeHtml(formatExpiration(input.expiresAt))}までに開いて、新しいパスワードを設定してください。</p>`,
    `<p><a href="${resetUrl}">${resetUrl}</a></p>`,
    "<p>この申請に心当たりがない場合は、このメールを破棄してください。</p>",
    "</body>",
    "</html>",
  ].join("");
}

function formatExpiration(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(value);
}

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();

  return value ? value : null;
}

function readOptionalIntegerEnv(name: string) {
  const value = readOptionalEnv(name);

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readOptionalBooleanEnv(name: string) {
  const value = readOptionalEnv(name)?.toLowerCase();

  if (!value) {
    return null;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return null;
}

function createFailureReason(error: unknown) {
  return error instanceof Error && error.message
    ? `delivery_failed:${error.message}`
    : "delivery_failed";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}
