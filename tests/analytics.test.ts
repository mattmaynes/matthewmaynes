// Unit tests for the PostHog capture gate (spec 0016). The rule - only a
// production build on the real host captures, so local runs never pollute the
// live dashboard - lives in a pure JS seam, so it is provable without a browser.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLocalHost,
  isClientAnalyticsEnabled,
  isServerAnalyticsEnabled,
} from "../src/lib/analytics-env.ts";

test("isLocalHost recognizes every local form (port stripped)", () => {
  for (const h of [
    "localhost",
    "127.0.0.1",
    "127.0.0.1:3000",
    "0.0.0.0",
    "::1",
    "[::1]",
    "LOCALHOST",
    "my-box.local",
    "app.localhost",
    "localhost:8080",
    "[::1]:3000",
  ]) {
    assert.equal(isLocalHost(h), true, `expected ${h} to be local`);
  }
});

test("isLocalHost treats real + empty hosts as non-local", () => {
  assert.equal(isLocalHost("matthewmaynes.com"), false);
  assert.equal(isLocalHost("www.matthewmaynes.com"), false);
  assert.equal(isLocalHost(""), false);
  assert.equal(isLocalHost(undefined), false);
  // Suffix match must be anchored on a dot boundary, not a substring - guards
  // against `.endsWith(".localhost")` regressing to `.includes("localhost")`.
  assert.equal(isLocalHost("localhost.example.com"), false);
  assert.equal(isLocalHost("notlocalhost"), false);
  assert.equal(isLocalHost("mylocal"), false);
});

test("isClientAnalyticsEnabled: only production build on a real host", () => {
  // The one enabled case: deployed client.
  assert.equal(
    isClientAnalyticsEnabled({
      nodeEnv: "production",
      hostname: "matthewmaynes.com",
    }),
    true,
  );
  // Disabled: dev (next dev), regardless of host.
  assert.equal(
    isClientAnalyticsEnabled({
      nodeEnv: "development",
      hostname: "matthewmaynes.com",
    }),
    false,
  );
  // Disabled: local production build (npm start / smoke / Playwright) on localhost.
  assert.equal(
    isClientAnalyticsEnabled({ nodeEnv: "production", hostname: "localhost" }),
    false,
  );
  assert.equal(
    isClientAnalyticsEnabled({ nodeEnv: "production", hostname: "127.0.0.1" }),
    false,
  );
  // Disabled: no hostname (SSR / unknown).
  assert.equal(
    isClientAnalyticsEnabled({ nodeEnv: "production", hostname: "" }),
    false,
  );
  assert.equal(isClientAnalyticsEnabled({ nodeEnv: "test" }), false);
});

test("isServerAnalyticsEnabled: production AND the deploy-only flag", () => {
  // The one enabled case: deployed container (NODE_ENV=production + flag set).
  assert.equal(
    isServerAnalyticsEnabled({ nodeEnv: "production", captureFlag: "1" }),
    true,
  );
  // Disabled: local production build (NODE_ENV=production, no flag) - the hole the
  // review caught. Covers npm start, the smoke test, and local docker compose up.
  assert.equal(
    isServerAnalyticsEnabled({ nodeEnv: "production", captureFlag: undefined }),
    false,
  );
  assert.equal(
    isServerAnalyticsEnabled({ nodeEnv: "production", captureFlag: "0" }),
    false,
  );
  // Disabled: dev, even if the flag somehow leaked into the env.
  assert.equal(
    isServerAnalyticsEnabled({ nodeEnv: "development", captureFlag: "1" }),
    false,
  );
  assert.equal(isServerAnalyticsEnabled({ nodeEnv: undefined }), false);
});
