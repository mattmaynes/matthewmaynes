// Unit tests for the pure preview-auth core (spec 0036): sign/verify round-trip,
// forgery/wrong-password/fail-closed rejection, and the open-redirect guard. No
// server - the HMAC uses Web Crypto (globalThis.crypto), available under node:test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession, safeNext, DEFAULT_NEXT } from "../src/lib/preview-auth.ts";

test("signSession/verifySession round-trips for the right password", async () => {
  const token = await signSession("hunter2");
  assert.ok(token.length > 0, "expected a non-empty token");
  assert.equal(await verifySession(token, "hunter2"), true);
});

test("signSession is deterministic for a given secret", async () => {
  assert.equal(await signSession("hunter2"), await signSession("hunter2"));
  assert.notEqual(await signSession("hunter2"), await signSession("other"));
});

test("verifySession rejects a tampered token", async () => {
  const token = await signSession("hunter2");
  // Flip the last character but keep the length (exercises the constant-time path).
  const last = token.slice(-1) === "A" ? "B" : "A";
  const tampered = token.slice(0, -1) + last;
  assert.equal(await verifySession(tampered, "hunter2"), false);
});

test("verifySession rejects the wrong password", async () => {
  const token = await signSession("hunter2");
  assert.equal(await verifySession(token, "wrong"), false);
});

test("verifySession fails closed for an empty/undefined secret or token", async () => {
  const token = await signSession("hunter2");
  assert.equal(await verifySession(token, ""), false);
  assert.equal(await verifySession(token, undefined), false);
  assert.equal(await verifySession(token, null), false);
  assert.equal(await verifySession("", "hunter2"), false);
  assert.equal(await verifySession(undefined, "hunter2"), false);
  // A falsy secret also cannot mint a usable token.
  assert.equal(await signSession(""), "");
  assert.equal(await signSession(undefined), "");
});

test("safeNext keeps same-origin in-app paths", () => {
  assert.equal(safeNext("/blog/drafts"), "/blog/drafts");
  assert.equal(safeNext("/blog/drafts/the-post"), "/blog/drafts/the-post");
  assert.equal(safeNext("/blog/drafts?x=1"), "/blog/drafts?x=1");
});

test("safeNext rejects off-site / malformed targets, defaulting", () => {
  assert.equal(safeNext("//evil.com"), DEFAULT_NEXT);
  assert.equal(safeNext("https://evil.com"), DEFAULT_NEXT);
  assert.equal(safeNext("http://x"), DEFAULT_NEXT);
  assert.equal(safeNext("/\\evil.com"), DEFAULT_NEXT);
  assert.equal(safeNext("evil.com"), DEFAULT_NEXT);
  assert.equal(safeNext("/bad\nLocation"), DEFAULT_NEXT);
  assert.equal(safeNext(123), DEFAULT_NEXT);
  assert.equal(safeNext(null), DEFAULT_NEXT);
  assert.equal(safeNext(undefined), DEFAULT_NEXT);
});
