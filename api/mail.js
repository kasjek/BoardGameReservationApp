/**
 * Outbound mail. Abuse reports go to ABUSE_REPORT_TO (info@toomanygames.de).
 * When SMTP is unset, messages are logged (and kept in `outbox` for tests).
 */
const fs = require("fs");
const net = require("net");
const path = require("path");
const tls = require("tls");

const ABUSE_REPORT_TO = process.env.ABUSE_REPORT_TO || "info@toomanygames.de";
const MAIL_FROM = process.env.MAIL_FROM || "noreply@toomanygames.de";

const outbox = [];

function mailLogPath() {
  const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  return path.join(dir, "mail.log");
}

function record(entry) {
  outbox.push(entry);
  try {
    fs.mkdirSync(path.dirname(mailLogPath()), { recursive: true });
    fs.appendFileSync(
      mailLogPath(),
      `${entry.at}\t${entry.to}\t${entry.subject}\n${entry.text}\n---\n`,
    );
  } catch (err) {
    console.error("[mail] log write failed", err.message);
  }
}

function smtpWrite(socket, line) {
  return new Promise((resolve, reject) => {
    socket.write(`${line}\r\n`, (err) => (err ? reject(err) : resolve()));
  });
}

function smtpRead(socket) {
  return new Promise((resolve, reject) => {
    const onData = (buf) => {
      socket.off("error", onErr);
      resolve(buf.toString("utf8"));
    };
    const onErr = (err) => {
      socket.off("data", onData);
      reject(err);
    };
    socket.once("data", onData);
    socket.once("error", onErr);
  });
}

async function sendViaSmtp({ to, subject, text }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  if (!host) return { ok: true, skipped: true };

  const insecure = process.env.SMTP_SECURE === "1" || port === 465;
  const connect = () =>
    new Promise((resolve, reject) => {
      const sock = insecure
        ? tls.connect({ host, port, servername: host }, () => resolve(sock))
        : net.connect({ host, port }, () => resolve(sock));
      sock.setTimeout(12_000);
      sock.on("error", reject);
      sock.on("timeout", () => reject(new Error("SMTP timeout")));
    });

  const socket = await connect();
  try {
    await smtpRead(socket);
    await smtpWrite(socket, `EHLO toomanygames.de`);
    await smtpRead(socket);
    if (!insecure && port === 587) {
      await smtpWrite(socket, "STARTTLS");
      const start = await smtpRead(socket);
      if (!start.startsWith("220")) throw new Error(`STARTTLS failed: ${start.trim()}`);
      await new Promise((resolve, reject) => {
        const secure = tls.connect({ socket, servername: host }, () => resolve(secure));
        secure.on("error", reject);
      });
    }
    if (user) {
      await smtpWrite(socket, "AUTH LOGIN");
      await smtpRead(socket);
      await smtpWrite(socket, Buffer.from(user).toString("base64"));
      await smtpRead(socket);
      await smtpWrite(socket, Buffer.from(pass).toString("base64"));
      const auth = await smtpRead(socket);
      if (!auth.startsWith("235")) throw new Error(`SMTP auth failed: ${auth.trim()}`);
    }
    await smtpWrite(socket, `MAIL FROM:<${MAIL_FROM}>`);
    await smtpRead(socket);
    await smtpWrite(socket, `RCPT TO:<${to}>`);
    await smtpRead(socket);
    await smtpWrite(socket, "DATA");
    await smtpRead(socket);
    const body =
      `From: ${MAIL_FROM}\r\nTo: ${to}\r\nSubject: ${subject}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n.`;
    await smtpWrite(socket, body);
    await smtpRead(socket);
    await smtpWrite(socket, "QUIT");
    return { ok: true, skipped: false };
  } finally {
    socket.destroy();
  }
}

async function sendMail({ to, subject, text }) {
  const entry = {
    to: to || ABUSE_REPORT_TO,
    subject: subject || "",
    text: text || "",
    at: new Date().toISOString(),
  };
  record(entry);
  try {
    return await sendViaSmtp(entry);
  } catch (err) {
    console.error("[mail] SMTP send failed", err.message);
    return { ok: false, error: err.message };
  }
}

async function sendAbuseReportEmail({ reporter, accused, issue, context }) {
  const subject = `Abuse report: ${reporter.username} reported ${accused.username}`;
  const text = [
    "Too Many Games — abusive behavior report",
    "",
    `Reporter: ${reporter.username} (user id ${reporter.id})`,
    `Reported user: ${accused.username} (user id ${accused.id})`,
    context ? `Context: ${context}` : null,
    "",
    "Issue:",
    issue,
    "",
    `Filed at: ${new Date().toISOString()}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  return sendMail({ to: ABUSE_REPORT_TO, subject, text });
}

function drainOutbox() {
  return outbox.splice(0);
}

module.exports = {
  ABUSE_REPORT_TO,
  MAIL_FROM,
  sendMail,
  sendAbuseReportEmail,
  drainOutbox,
};
