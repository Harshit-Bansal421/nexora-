import test from "node:test";
import assert from "node:assert/strict";
import { sendEmail } from "../src/utils/Email.js";

const withEmailConfig = async (config, callback) => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  const previousFetch = globalThis.fetch;
  if (config.apiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = config.apiKey;
  if (config.from === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = config.from;
  try {
    await callback((fetchMock) => {
      globalThis.fetch = fetchMock;
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previousFrom;
  }
};

test("sendEmail returns the accepted Resend message", async () => {
  await withEmailConfig(
    { apiKey: "test_key", from: "Nexora <noreply@example.com>" },
    async (setFetch) => {
      let requestBody;
      setFetch(async (url, options) => {
        assert.equal(String(url), "https://api.resend.com/emails");
        assert.equal(options.method, "POST");
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({ id: "email_test_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });

      const result = await sendEmail({ to: "user@example.com", html: "<p>OTP</p>" });
      assert.equal(result.id, "email_test_123");
      assert.deepEqual(requestBody, {
        from: "Nexora <noreply@example.com>",
        to: "user@example.com",
        subject: "verify",
        html: "<p>OTP</p>",
      });
    },
  );
});

test("sendEmail reports provider rejection as a sanitized 503", async () => {
  await withEmailConfig(
    { apiKey: "test_key", from: "Nexora <noreply@example.com>" },
    async (setFetch) => {
      setFetch(async () =>
        new Response(JSON.stringify({
          statusCode: 403,
          name: "validation_error",
          message: "sender is not verified",
        }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      );
      await assert.rejects(sendEmail({ to: "user@example.com", html: "x" }), {
        statuscode: 503,
        message: "Email delivery is temporarily unavailable",
      });
    },
  );
});

test("sendEmail reports a transport failure as a sanitized 503", async () => {
  await withEmailConfig(
    { apiKey: "test_key", from: "Nexora <noreply@example.com>" },
    async (setFetch) => {
      setFetch(async () => {
        throw new Error("network failure");
      });
      await assert.rejects(sendEmail({ to: "user@example.com", html: "x" }), {
        statuscode: 503,
        message: "Email delivery is temporarily unavailable",
      });
    },
  );
});

test("sendEmail rejects missing server configuration before making a request", async () => {
  await withEmailConfig({}, async (setFetch) => {
    let requested = false;
    setFetch(async () => {
      requested = true;
      return new Response("{}", { status: 200 });
    });
    await assert.rejects(sendEmail({ to: "user@example.com", html: "x" }), {
      statuscode: 503,
      message: "Email delivery is temporarily unavailable",
    });
    assert.equal(requested, false);
  });
});
