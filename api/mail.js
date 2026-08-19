/**
 * Transactional email. Dev (no EMAIL_HOST) logs to stdout. Production needs SMTP.
 */
function emailConfigured() {
  if ((process.env.EMAIL_HOST || "").trim()) return true;
  return process.env.NODE_ENV !== "production";
}

function publicAppUrl() {
  return (process.env.PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

function fromAddress() {
  return process.env.DEFAULT_FROM_EMAIL || "Too Many Games <noreply@localhost>";
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} payload
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function sendMail(payload) {
  if (!emailConfigured()) {
    return { ok: false, error: "Email delivery is not configured." };
  }
  const host = (process.env.EMAIL_HOST || "").trim();
  if (!host) {
    console.log(`[mail] to=${payload.to}\nsubject=${payload.subject}\n${payload.text}`);
    return { ok: true };
  }
  try {
    // Lazy require so tests/dev without SMTP do not need the package loaded.
    const nodemailer = require("nodemailer");
    const port = Number(process.env.EMAIL_PORT || 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587 && process.env.EMAIL_USE_TLS !== "0",
      auth: process.env.EMAIL_HOST_USER
        ? {
            user: process.env.EMAIL_HOST_USER,
            pass: process.env.EMAIL_HOST_PASSWORD || "",
          }
        : undefined,
    });
    await transporter.sendMail({
      from: fromAddress(),
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[mail]", err);
    return { ok: false, error: "Activation email could not be sent." };
  }
}

module.exports = { emailConfigured, publicAppUrl, sendMail, fromAddress };
