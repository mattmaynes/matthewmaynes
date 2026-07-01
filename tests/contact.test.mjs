// Unit tests for the contact endpoint's pure core (src/lib/contact.js): input
// validation, the honeypot + same-origin spam checks, the rate limiter, and the
// Resend payload shaping + send. No server, no network - the send path injects a
// fake fetch. The route handler (app/v1/contact) is a thin shell over these and
// its HTTP behavior is covered by the smoke test.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITS,
  validateContact,
  isHoneypotFilled,
  isSameOrigin,
  createRateLimiter,
  buildResendPayload,
  sendViaResend,
} from "../src/lib/contact.js";

test("validateContact accepts and trims a good submission", () => {
  const r = validateContact({
    name: "  Ada  ",
    email: " ada@example.com ",
    message: "  hi there  ",
  });
  assert.ok(r.ok);
  assert.deepEqual(r.data, {
    name: "Ada",
    email: "ada@example.com",
    message: "hi there",
  });
});

test("validateContact rejects missing or blank fields", () => {
  for (const bad of [
    { name: "", email: "a@b.co", message: "hi" },
    { name: "A", email: "", message: "hi" },
    { name: "A", email: "a@b.co", message: "   " },
    {},
  ]) {
    assert.equal(validateContact(bad).ok, false);
  }
});

test("validateContact rejects a malformed email", () => {
  for (const email of ["nope", "a@b", "a b@c.co", "@c.co", "a@.co", "a@b."]) {
    assert.equal(
      validateContact({ name: "A", email, message: "hi" }).ok,
      false,
      `expected "${email}" to be rejected`,
    );
  }
});

test("validateContact enforces length caps", () => {
  assert.equal(
    validateContact({
      name: "x".repeat(LIMITS.name + 1),
      email: "a@b.co",
      message: "hi",
    }).ok,
    false,
  );
  assert.equal(
    validateContact({
      name: "A",
      email: "a@" + "b".repeat(LIMITS.email) + ".co",
      message: "hi",
    }).ok,
    false,
  );
  assert.equal(
    validateContact({
      name: "A",
      email: "a@b.co",
      message: "x".repeat(LIMITS.message + 1),
    }).ok,
    false,
  );
});

test("validateContact accepts values exactly at the caps (guards > vs >=)", () => {
  const r = validateContact({
    name: "x".repeat(LIMITS.name),
    email: "a".repeat(LIMITS.email - 5) + "@b.co", // exactly LIMITS.email chars
    message: "y".repeat(LIMITS.message),
  });
  assert.ok(r.ok, "a value exactly at the cap must be accepted");
});

test("validateContact ignores non-string inputs", () => {
  assert.equal(validateContact({ name: 5, email: {}, message: [] }).ok, false);
});

test("isHoneypotFilled is true only for a non-empty string", () => {
  assert.equal(isHoneypotFilled("bot"), true);
  assert.equal(isHoneypotFilled("  "), false);
  assert.equal(isHoneypotFilled(""), false);
  assert.equal(isHoneypotFilled(undefined), false);
  assert.equal(isHoneypotFilled(1), false);
});

test("isSameOrigin matches host, ignores scheme, and needs a source", () => {
  assert.equal(isSameOrigin("https://x.com", null, "x.com"), true);
  assert.equal(isSameOrigin("http://x.com", null, "x.com"), true); // scheme-agnostic
  assert.equal(isSameOrigin(null, "https://x.com/page", "x.com"), true); // referer fallback
  assert.equal(isSameOrigin("https://evil.com", null, "x.com"), false);
  assert.equal(isSameOrigin(null, null, "x.com"), false); // no source
  assert.equal(isSameOrigin("https://x.com", null, null), false); // no host
  assert.equal(isSameOrigin("not a url", null, "x.com"), false); // unparseable
});

test("createRateLimiter allows up to max per window, then blocks, per key", () => {
  const rl = createRateLimiter({ max: 2, windowMs: 1000 });
  assert.equal(rl.check("ip", 0), true);
  assert.equal(rl.check("ip", 100), true);
  assert.equal(rl.check("ip", 200), false); // 3rd within the window
  assert.equal(rl.check("ip", 1201), true); // the first two have aged out
  assert.equal(rl.check("other", 200), true); // independent per key
});

test("buildResendPayload wires reply_to + body from the visitor, to/from from caller", () => {
  const p = buildResendPayload({
    name: "Ada",
    email: "ada@x.co",
    message: "hello world",
    to: "me@private.co",
    from: "Form <contact@site.co>",
  });
  assert.equal(p.to, "me@private.co");
  assert.equal(p.from, "Form <contact@site.co>");
  assert.equal(p.reply_to, "ada@x.co");
  assert.match(p.subject, /Ada/);
  assert.match(p.text, /hello world/);
  assert.match(p.text, /ada@x\.co/);
});

test("buildResendPayload keeps the subject single-line (no header injection)", () => {
  const p = buildResendPayload({
    name: "Ada\r\nBcc: evil@x.co",
    email: "a@b.co",
    message: "hi",
    to: "t",
    from: "f",
  });
  assert.ok(!/[\r\n]/.test(p.subject), "subject must not contain CR/LF");
  assert.match(p.subject, /Ada/);
});

test("sendViaResend posts to Resend with bearer auth and resolves on 2xx", async () => {
  let captured;
  const fakeFetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, status: 200, text: async () => "" };
  };
  await sendViaResend(
    { from: "f", to: "t", reply_to: "r", subject: "s", text: "b" },
    "key123",
    fakeFetch,
  );
  assert.equal(captured.url, "https://api.resend.com/emails");
  assert.equal(captured.opts.method, "POST");
  assert.equal(captured.opts.headers.Authorization, "Bearer key123");
  assert.equal(captured.opts.headers["Content-Type"], "application/json");
  assert.match(captured.opts.body, /"to":"t"/);
  assert.match(captured.opts.body, /"reply_to":"r"/);
});

test("sendViaResend throws on a non-2xx response", async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 422,
    text: async () => "bad request",
  });
  await assert.rejects(
    () => sendViaResend({}, "key", fakeFetch),
    /Resend responded 422/,
  );
});
