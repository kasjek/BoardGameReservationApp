#!/usr/bin/env node
/**
 * reCAPTCHA v2 gate for registration (mocked Google siteverify).
 */
process.env.NODE_ENV = "test";
delete process.env.RECAPTCHA_SITE_KEY;
delete process.env.RECAPTCHA_SECRET_KEY;

const {
  captchaPublicConfig,
  recaptchaKeys,
  TEST_SITE_KEY,
  verifyCaptcha,
  SITEVERIFY_URL,
} = require("./captcha");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok ", msg);
  }
}

(async () => {
  const keys = recaptchaKeys();
  assert(keys.enabled === true, "non-production uses Google test keys");
  assert(keys.siteKey === TEST_SITE_KEY, "site key is the documented test key");
  assert(captchaPublicConfig().captcha_enabled === true, "public config enabled");
  assert(captchaPublicConfig().recaptcha_site_key === TEST_SITE_KEY, "public config site key");

  const missing = await verifyCaptcha("");
  assert(missing.ok === false && /required/i.test(missing.error), "empty token is required error");

  const fakeFetch = async (url, opts) => {
    assert(String(url) === SITEVERIFY_URL, `siteverify URL ${url}`);
    assert(opts.method === "POST", "POST siteverify");
    const body = String(opts.body);
    if (body.includes("good-token")) {
      return { json: async () => ({ success: true }) };
    }
    return { json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }) };
  };

  const bad = await verifyCaptcha("forged", null, { fetch: fakeFetch });
  assert(bad.ok === false && /failed/i.test(bad.error), "Google failure is rejected");

  const good = await verifyCaptcha("good-token", "127.0.0.1", { fetch: fakeFetch });
  assert(good.ok === true, "Google success is accepted");

  const boom = await verifyCaptcha("x", null, {
    fetch: async () => {
      throw new Error("network");
    },
  });
  assert(boom.ok === false, "network errors fail closed");

  process.env.NODE_ENV = "production";
  delete process.env.RECAPTCHA_SITE_KEY;
  delete process.env.RECAPTCHA_SECRET_KEY;
  const prod = recaptchaKeys();
  assert(prod.enabled === false, "production without keys is disabled");
  assert(captchaPublicConfig().captcha_enabled === false, "production public config disabled");
  const closed = await verifyCaptcha("anything");
  assert(closed.ok === false && /not configured/i.test(closed.error), "production fail-closed");

  process.env.NODE_ENV = "production";
  process.env.RECAPTCHA_SITE_KEY = TEST_SITE_KEY;
  process.env.RECAPTCHA_SECRET_KEY = require("./captcha").TEST_SECRET_KEY;
  assert(recaptchaKeys().enabled === false, "production rejects Google test keys");

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
