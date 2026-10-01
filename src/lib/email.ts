import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body; the HTML version is derived from it. */
  text: string;
  /** Optional call-to-action rendered as a button in the HTML version. */
  action?: { label: string; url: string };
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  const port = Number(SMTP_PORT ?? 465);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

/** Absolute base URL for links in emails. Never derived from request headers. */
export function appUrl(path = "/"): string {
  const base = (
    process.env.APP_URL ??
    process.env.URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${base}${path}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml({ subject, text, action }: EmailMessage): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  const button = action
    ? `<p style="margin:20px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">${escapeHtml(action.label)}</a></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:0 auto;padding:24px">
<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0">
<h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(subject)}</h1>
${paragraphs}${button}
</div>
<p style="font-size:12px;color:#64748b;text-align:center;margin-top:16px">FinTrack — know your money, plan your future.</p>
</div></body></html>`;
}

/**
 * Sends best-effort: a mail failure is logged, never thrown, so it can't
 * roll back or block the change that triggered it.
 */
export async function sendEmails(messages: EmailMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const transport = getTransporter();
  if (!transport) {
    console.info(
      `[email] SMTP not configured — skipped ${messages.length} email(s):`,
      messages.map((m) => `${m.to}: ${m.subject}`),
    );
    return;
  }

  const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER;
  const results = await Promise.allSettled(
    messages.map((m) =>
      transport.sendMail({
        from,
        to: m.to,
        subject: m.subject,
        text: m.action
          ? `${m.text}\n\n${m.action.label}: ${m.action.url}`
          : m.text,
        html: renderHtml(m),
      }),
    ),
  );

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(
        `[email] Failed to send to ${messages[i].to}`,
        result.reason,
      );
    }
  });
}
