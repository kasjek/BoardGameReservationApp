/**
 * Google reCAPTCHA v2 for self-registration.
 *
 * Production must set RECAPTCHA_SITE_KEY + RECAPTCHA_SECRET_KEY.
 * In non-production, Google's documented always-pass test keys are the default
 * so local/demo still shows a checkbox. Test keys are rejected in production.
 */
const SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/** https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha.-what-should-i-do */
const TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
const TEST_SECRET_KEY = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNLuL5rOJbpCII";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function recaptchaKeys() {
  const siteKey = (process.env.RECAPTCHA_SITE_KEY || (!isProduction() ? TEST_SITE_KEY : "")).trim();
  const secretKey = (
    process.env.RECAPTCHA_SECRET_KEY || (!isProduction() ? TEST_SECRET_KEY : "")
  ).trim();
  const usingTestKeys = secretKey === TEST_SECRET_KEY || siteKey === TEST_SITE_KEY;
  const enabled = Boolean(siteKey && secretKey) && !(isProduction() && usingTestKeys);
  return { siteKey, secretKey, enabled };
}

function captchaPublicConfig() {
  const { siteKey, enabled } = recaptchaKeys();
  return {
    captcha_enabled: enabled,
    recaptcha_site_key: enabled ? siteKey : null,
  };
}

/**
 * Verify a reCAPTCHA v2 response token with Google.
 * @param {string} token
 * @param {string} [remoteIp]
 * @param {{ fetch?: typeof fetch }} [deps]
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function verifyCaptcha(token, remoteIp, deps = {}) {
  const { secretKey, enabled } = recaptchaKeys();
  if (!enabled) {
    return { ok: false, error: "Captcha is not configured." };
  }
  const value = typeof token === "string" ? token.trim() : "";
  if (!value) {
    return { ok: false, error: "Captcha is required." };
  }
  const doFetch = deps.fetch || fetch;
  const body = new URLSearchParams({ secret: secretKey, response: value });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const resp = await doFetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await resp.json();
    if (!data || data.success !== true) {
      return { ok: false, error: "Captcha verification failed." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Captcha verification failed." };
  }
}

module.exports = {
  TEST_SITE_KEY,
  TEST_SECRET_KEY,
  SITEVERIFY_URL,
  recaptchaKeys,
  captchaPublicConfig,
  verifyCaptcha,
};
