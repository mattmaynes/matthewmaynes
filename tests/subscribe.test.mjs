// Unit tests for the subscribe endpoint's pure core (src/lib/subscribe.js): email
// validation, the Constant Contact sign_up_form payload shaping, the OAuth
// refresh-token exchange, the add-contact call, and the in-memory access-token
// cache. No server, no network - every network path injects a fake fetch and the
// cache injects a fake clock. The route handler (app/v1/subscribe) is a thin shell
// over these and its HTTP behavior is covered by the smoke test.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUBSCRIBE_LIMITS,
  validateSubscribe,
  buildSignUpPayload,
  refreshAccessToken,
  addContactToList,
  createTokenCache,
  submitSubscription,
} from "../src/lib/subscribe.js";

test("validateSubscribe accepts and trims a good email", () => {
  const r = validateSubscribe({ email: "  reader@example.com  " });
  assert.ok(r.ok);
  assert.deepEqual(r.data, { email: "reader@example.com" });
});

test("validateSubscribe rejects missing, blank, or non-string emails", () => {
  for (const bad of [{ email: "" }, { email: "   " }, {}, { email: 5 }, { email: {} }]) {
    assert.equal(validateSubscribe(bad).ok, false);
  }
});

test("validateSubscribe rejects a malformed email", () => {
  for (const email of ["nope", "a@b", "a b@c.co", "@c.co", "a@.co", "a@b."]) {
    assert.equal(
      validateSubscribe({ email }).ok,
      false,
      `expected "${email}" to be rejected`,
    );
  }
});

test("validateSubscribe enforces the length cap (guards > vs >=)", () => {
  // Exactly at the cap is accepted; one over is rejected.
  const atCap = "a".repeat(SUBSCRIBE_LIMITS.email - 5) + "@b.co"; // == cap chars
  assert.ok(validateSubscribe({ email: atCap }).ok, "cap-length email must pass");
  const overCap = "a".repeat(SUBSCRIBE_LIMITS.email) + "@b.co";
  assert.equal(validateSubscribe({ email: overCap }).ok, false);
});

test("buildSignUpPayload shapes the create-or-update body with the list membership", () => {
  const p = buildSignUpPayload("reader@example.com", "list-123");
  assert.deepEqual(p, {
    email_address: "reader@example.com",
    create_source: "Contact",
    list_memberships: ["list-123"],
  });
});

test("refreshAccessToken posts the refresh grant and returns the token + ttl", async () => {
  let captured;
  const fakeFetch = async (url, opts) => {
    captured = { url, opts };
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "tok-abc", expires_in: 86400 }),
    };
  };
  const out = await refreshAccessToken(
    { clientId: "cid-1", refreshToken: "rt-9" },
    fakeFetch,
  );
  assert.deepEqual(out, { accessToken: "tok-abc", expiresInSec: 86400 });
  assert.equal(
    captured.url,
    "https://authz.constantcontact.com/oauth2/default/v1/token",
  );
  assert.equal(captured.opts.method, "POST");
  assert.equal(
    captured.opts.headers["Content-Type"],
    "application/x-www-form-urlencoded",
  );
  // Public client: grant + refresh token + client id, and NO client secret.
  assert.match(captured.opts.body, /grant_type=refresh_token/);
  assert.match(captured.opts.body, /refresh_token=rt-9/);
  assert.match(captured.opts.body, /client_id=cid-1/);
  assert.ok(!/client_secret/.test(captured.opts.body), "must not send a client secret");
});

test("refreshAccessToken throws on a non-2xx", async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 401,
    text: async () => "invalid_grant",
  });
  await assert.rejects(
    () => refreshAccessToken({ clientId: "c", refreshToken: "r" }, fakeFetch),
    /Constant Contact token responded 401/,
  );
});

test("refreshAccessToken throws when the body has no access_token", async () => {
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  await assert.rejects(
    () => refreshAccessToken({ clientId: "c", refreshToken: "r" }, fakeFetch),
    /missing access_token/,
  );
});

test("addContactToList posts sign_up_form with bearer auth and the payload", async () => {
  let captured;
  const fakeFetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, status: 201, text: async () => "" };
  };
  await addContactToList(
    { accessToken: "tok-xyz", email: "reader@example.com", listId: "list-7" },
    fakeFetch,
  );
  assert.equal(captured.url, "https://api.cc.email/v3/contacts/sign_up_form");
  assert.equal(captured.opts.method, "POST");
  assert.equal(captured.opts.headers.Authorization, "Bearer tok-xyz");
  assert.equal(captured.opts.headers["Content-Type"], "application/json");
  const body = JSON.parse(captured.opts.body);
  assert.equal(body.email_address, "reader@example.com");
  assert.equal(body.create_source, "Contact");
  assert.deepEqual(body.list_memberships, ["list-7"]);
});

test("addContactToList throws status-only on a non-2xx (never the response body / PII)", async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 400,
    // A real sign_up_form 4xx body can echo the submitted address; include one to
    // prove it never reaches the thrown Error (which the route logs to stdout).
    text: async () => "invalid: reader@example.com is on a suppression list",
  });
  const err = await addContactToList(
    { accessToken: "t", email: "reader@example.com", listId: "l" },
    fakeFetch,
  ).then(
    () => {
      throw new Error("expected a rejection");
    },
    (e) => e,
  );
  assert.match(err.message, /sign_up_form responded 400/);
  assert.equal(err.status, 400, "status attached so callers can branch (401 self-heal)");
  assert.ok(
    !/reader@example\.com/.test(err.message),
    "the error message must not carry the response body / email (PII in logs)",
  );
});

test("createTokenCache mints once, reuses within ttl, re-mints after expiry", async () => {
  let clock = 1_000_000;
  let refreshes = 0;
  const fakeFetch = async () => {
    refreshes++;
    return {
      ok: true,
      status: 200,
      // 100s ttl; the cache applies a 60s skew, so it is valid for ~40s.
      json: async () => ({ access_token: `tok-${refreshes}`, expires_in: 100 }),
    };
  };
  const cache = createTokenCache(() => clock);
  const creds = { clientId: "c", refreshToken: "r" };

  const first = await cache.getAccessToken(creds, fakeFetch);
  assert.equal(first, "tok-1");
  assert.equal(refreshes, 1);

  // 30s later: still within the skewed ttl, so the cached token is reused.
  clock += 30_000;
  const second = await cache.getAccessToken(creds, fakeFetch);
  assert.equal(second, "tok-1");
  assert.equal(refreshes, 1, "must not refresh while cached token is valid");

  // Past the skewed expiry: a new token is minted.
  clock += 60_000;
  const third = await cache.getAccessToken(creds, fakeFetch);
  assert.equal(third, "tok-2");
  assert.equal(refreshes, 2, "must re-mint once the cached token has expired");
});

test("submitSubscription gets a token then adds the contact to the list", async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (url.includes("/oauth2/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok-cached", expires_in: 86400 }),
      };
    }
    return { ok: true, status: 200, text: async () => "" };
  };
  const cache = createTokenCache();
  await submitSubscription(
    {
      email: "reader@example.com",
      clientId: "c",
      refreshToken: "r",
      listId: "list-42",
    },
    { fetchImpl: fakeFetch, cache },
  );
  assert.equal(calls.length, 2, "expected a token call then a sign_up_form call");
  assert.match(calls[0], /oauth2\/default\/v1\/token/);
  assert.match(calls[1], /contacts\/sign_up_form/);
});

test("submitSubscription reuses the cached token across two submits", async () => {
  let tokenCalls = 0;
  const fakeFetch = async (url) => {
    if (url.includes("/oauth2/")) {
      tokenCalls++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok", expires_in: 86400 }),
      };
    }
    return { ok: true, status: 200, text: async () => "" };
  };
  const cache = createTokenCache();
  const args = { clientId: "c", refreshToken: "r", listId: "l" };
  await submitSubscription({ email: "a@b.co", ...args }, { fetchImpl: fakeFetch, cache });
  await submitSubscription({ email: "c@d.co", ...args }, { fetchImpl: fakeFetch, cache });
  assert.equal(tokenCalls, 1, "the second submit must reuse the cached token");
});

test("submitSubscription rejects when sign_up_form fails, without leaking the email", async () => {
  const fakeFetch = async (url) => {
    if (url.includes("/oauth2/"))
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok", expires_in: 86400 }),
      };
    // A non-401 failure (e.g. 400) propagates - it is not retried - and its body
    // (which echoes the email) must never reach the thrown Error the route logs.
    return { ok: false, status: 400, text: async () => "invalid: reader@example.com" };
  };
  const cache = createTokenCache();
  const err = await submitSubscription(
    { email: "reader@example.com", clientId: "c", refreshToken: "r", listId: "l" },
    { fetchImpl: fakeFetch, cache },
  ).then(
    () => {
      throw new Error("expected a rejection");
    },
    (e) => e,
  );
  assert.equal(err.status, 400);
  assert.ok(
    !/reader@example\.com/.test(err.message),
    "the rejection must not carry the email (PII in logs)",
  );
});

test("submitSubscription self-heals once on a stale-token 401 (clear + re-mint + retry)", async () => {
  let tokenCalls = 0;
  let addCalls = 0;
  const fakeFetch = async (url) => {
    if (url.includes("/oauth2/")) {
      tokenCalls++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: `tok-${tokenCalls}`, expires_in: 86400 }),
      };
    }
    addCalls++;
    // The first add sees a token the upstream considers stale -> 401; after the
    // cache is cleared and a fresh token minted, the single retry succeeds.
    if (addCalls === 1)
      return { ok: false, status: 401, text: async () => "token expired" };
    return { ok: true, status: 200, text: async () => "" };
  };
  const cache = createTokenCache();
  await submitSubscription(
    { email: "a@b.co", clientId: "c", refreshToken: "r", listId: "l" },
    { fetchImpl: fakeFetch, cache },
  );
  assert.equal(addCalls, 2, "the add is retried exactly once after the 401");
  assert.equal(tokenCalls, 2, "a fresh token is minted for the retry");
});

test("submitSubscription does not retry past one 401 (a second 401 rejects)", async () => {
  const fakeFetch = async (url) => {
    if (url.includes("/oauth2/"))
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok", expires_in: 86400 }),
      };
    return { ok: false, status: 401, text: async () => "token expired" };
  };
  const cache = createTokenCache();
  const err = await submitSubscription(
    { email: "a@b.co", clientId: "c", refreshToken: "r", listId: "l" },
    { fetchImpl: fakeFetch, cache },
  ).then(
    () => {
      throw new Error("expected a rejection");
    },
    (e) => e,
  );
  assert.equal(err.status, 401, "a persistent 401 surfaces rather than looping");
});

test("createTokenCache dedupes a concurrent cold-cache burst into one mint", async () => {
  let tokenCalls = 0;
  const fakeFetch = async () => {
    tokenCalls++;
    // Yield so all concurrent callers have entered getAccessToken (and shared the
    // one in-flight promise) before the first mint resolves.
    await Promise.resolve();
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "tok", expires_in: 86400 }),
    };
  };
  const cache = createTokenCache();
  const creds = { clientId: "c", refreshToken: "r" };
  const results = await Promise.all(
    Array.from({ length: 5 }, () => cache.getAccessToken(creds, fakeFetch)),
  );
  assert.deepEqual(results, Array(5).fill("tok"), "all callers get the same token");
  assert.equal(tokenCalls, 1, "concurrent cold-cache callers share ONE mint");
});
