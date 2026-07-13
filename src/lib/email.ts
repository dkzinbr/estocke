import { ApiError } from "@/lib/api";
import nodemailer from "nodemailer";

function getAppUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendLoginVerificationEmail(params: {
  to: string;
  name: string;
  token: string;
}) {
  const verifyUrl = `${getAppUrl()}/auth/verify?token=${encodeURIComponent(params.token)}`;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@estocke.local";

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <h1 style="font-size:22px;margin:0 0 12px;">Confirm your access</h1>
      <p style="margin:0 0 16px;line-height:1.5;">
        Hello, ${params.name}. We received a login attempt on Estocke.
        Click the button below to confirm and unlock access.
      </p>
      <p style="margin:0 0 28px;">
        <a href="${verifyUrl}"
           style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">
          Confirm access
        </a>
      </p>
      <p style="margin:0;font-size:13px;color:#666;line-height:1.5;">
        This link expires in 15 minutes. If this was not you, ignore this email.
      </p>
    </div>
  `;

  const text = `Hello, ${params.name}. Confirm your Estocke access: ${verifyUrl}`;

  const transport = createTransport();

  if (!transport) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError("SMTP is not configured.", 500);
    }

    console.info("[auth] Verification email (dev):", verifyUrl);
    return { verifyUrl, previewOnly: true as const };
  }

  await transport.sendMail({
    from,
    to: params.to,
    subject: "Confirm your access — Estocke",
    text,
    html,
  });

  return { verifyUrl, previewOnly: false as const };
}
