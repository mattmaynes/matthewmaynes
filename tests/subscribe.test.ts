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
  isTestEmail,
  splitName,
  buildSignUpPayload,
  buildCreateContactPayload,
  refreshAccessToken,
  addContactToList,
  addUnsubscribedContact,
  createTokenCache,
  submitSubscription,
  recordWebsiteContact,
} from "../src/lib/subscribe.ts";

test("validateSubscribe accepts and trims a good email (name defaults empty)", () => {
  const r = validateSubscribe({ email: "  reader@example.com  " });
  assert.ok(r.ok);
  assert.deepEqual(r.data, { email: "reader@example.com", name: "" });
});

test("validateSubscribe accepts an optional name (trimmed, capped), never required", () => {
  // Present name is trimmed.
  const withName = validateSubscribe({ email: "a@b.co", name: "  Matthew Maynes  " });
  assert.ok(withName.ok);
  assert.equal(withName.data.name, "Matthew Maynes");
  // Absent / blank / non-string name still validates, normalized to "".
  for (const input of [
    { email: "a@b.co" },
    { email: "a@b.co", name: "   " },
    { email: "a@b.co", name: 5 },
  ]) {
    const r = validateSubscribe(input);
    assert.ok(r.ok, "an empty/absent name must still validate");
    assert.equal(r.data.name, "");
  }
  // Over-length name is capped, not rejected.
  const long = validateSubscribe({ email: "a@b.co", name: "x".repeat(500) });
  assert.ok(long.ok);
  assert.equal(long.data.name.length, SUBSCRIBE_LIMITS.name);
});

test("isTestEmail matches the internal test domain case-insensitively, anchored on @", () => {
  // Exact test domain, any casing, subscribes into the fake-success path.
  assert.equal(isTestEmail("me@matthewmaynes.com"), true);
  assert.equal(isTestEmail("ME@MatthewMaynes.COM"), true);
  assert.equal(isTestEmail("first.last+tag@matthewmaynes.com"), true);
  // A real subscriber is never diverted.
  assert.equal(isTestEmail("reader@example.com"), false);
  // The leading @ anchor guards against a look-alike domain and a subdomain -
  // both must still reach Constant Contact, not the fake-success path.
  assert.equal(isTestEmail("evil@notmatthewmaynes.com"), false);
  assert.equal(isTestEmail("x@mail.matthewmaynes.com"), false);
});

test("splitName splits on the first space into first/last name", () => {
  assert.deepEqual(splitName("Matthew"), { firstName: "Matthew" });
  assert.deepEqual(splitName("Matthew Maynes"), {
    firstName: "Matthew",
    lastName: "Maynes",
  });
  // Three+ tokens: the remainder (incl. a middle name) folds into the last name.
  assert.deepEqual(splitName("Matthew James Maynes"), {
    firstName: "Matthew",
    lastName: "James Maynes",
  });
});

test("splitName normalizes whitespace and handles empties", () => {
  assert.deepEqual(splitName("  Matthew   Maynes  "), {
    firstName: "Matthew",
    lastName: "Maynes",
  });
  for (const empty of ["", "   ", undefined, null, 42]) {
    assert.deepEqual(splitName(empty), {}, `expected {} for ${JSON.stringify(empty)}`);
  }
});

test("splitName caps each part at the Constant Contact field limit", () => {
  const first = "a".repeat(80);
  const last = "b".repeat(80);
  const parts = splitName(`${first} ${last}`);
  assert.equal(parts.firstName.length, SUBSCRIBE_LIMITS.part);
  assert.equal(parts.lastName.length, SUBSCRIBE_LIMITS.part);
});

test("splitName caps by code point, never splitting an astral character", () => {
  // Each astral emoji is 2 UTF-16 units; a naive .slice(0, 50) on a 51-emoji run
  // would cut the 25th emoji in half and leave a lone surrogate. Assert the capped
  // part is exactly 50 code points and contains no unpaired surrogate.
  const emoji = "\u{1F600}"; // grinning face (astral)
  const parts = splitName(emoji.repeat(60));
  assert.equal([...parts.firstName].length, SUBSCRIBE_LIMITS.part);
  assert.doesNotMatch(
    parts.firstName,
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,
    "capped part must contain no lone surrogate",
  );
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
  const p = buildSignUpPayload("reader@example.com", ["list-123"]);
  assert.deepEqual(p, {
    email_address: "reader@example.com",
    create_source: "Contact",
    list_memberships: ["list-123"],
  });
});

test("buildSignUpPayload omits first/last name when absent (identical to before)", () => {
  // A nameless signup must produce the exact same payload as the no-name feature.
  const noArg = buildSignUpPayload("a@b.co", ["l"]);
  const emptyParts = buildSignUpPayload("a@b.co", ["l"], {});
  const expected = {
    email_address: "a@b.co",
    create_source: "Contact",
    list_memberships: ["l"],
  };
  assert.deepEqual(noArg, expected);
  assert.deepEqual(emptyParts, expected);
  assert.ok(!("first_name" in emptyParts) && !("last_name" in emptyParts));
});

test("buildSignUpPayload adds first/last name only when present", () => {
  assert.deepEqual(buildSignUpPayload("a@b.co", ["l"], { firstName: "Matthew" }), {
    email_address: "a@b.co",
    create_source: "Contact",
    list_memberships: ["l"],
    first_name: "Matthew",
  });
  const both = buildSignUpPayload("a@b.co", ["l"], {
    firstName: "Matthew",
    lastName: "Maynes",
  });
  assert.equal(both.first_name, "Matthew");
  assert.equal(both.last_name, "Maynes");
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
    { accessToken: "tok-xyz", email: "reader@example.com", listIds: ["list-7"] },
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
    { accessToken: "t", email: "reader@example.com", listIds: ["l"] },
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
      listIds: ["list-42"],
    },
    { fetchImpl: fakeFetch, cache },
  );
  assert.equal(calls.length, 2, "expected a token call then a sign_up_form call");
  assert.match(calls[0], /oauth2\/default\/v1\/token/);
  assert.match(calls[1], /contacts\/sign_up_form/);
});

test("submitSubscription threads a split name into the sign_up_form body", async () => {
  let signupBody;
  const fakeFetch = async (url, opts) => {
    if (url.includes("/oauth2/"))
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok", expires_in: 86400 }),
      };
    signupBody = JSON.parse(opts.body);
    return { ok: true, status: 200, text: async () => "" };
  };
  const cache = createTokenCache();
  await submitSubscription(
    {
      email: "reader@example.com",
      name: "Matthew James Maynes",
      clientId: "c",
      refreshToken: "r",
      listIds: ["l"],
    },
    { fetchImpl: fakeFetch, cache },
  );
  assert.equal(signupBody.first_name, "Matthew");
  assert.equal(signupBody.last_name, "James Maynes");
  assert.equal(signupBody.email_address, "reader@example.com");
});

test("submitSubscription with no name sends no first/last name", async () => {
  let signupBody;
  const fakeFetch = async (url, opts) => {
    if (url.includes("/oauth2/"))
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok", expires_in: 86400 }),
      };
    signupBody = JSON.parse(opts.body);
    return { ok: true, status: 200, text: async () => "" };
  };
  const cache = createTokenCache();
  await submitSubscription(
    { email: "a@b.co", clientId: "c", refreshToken: "r", listIds: ["l"] },
    { fetchImpl: fakeFetch, cache },
  );
  assert.ok(!("first_name" in signupBody) && !("last_name" in signupBody));
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
  const args = { clientId: "c", refreshToken: "r", listIds: ["l"] };
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
    { email: "reader@example.com", clientId: "c", refreshToken: "r", listIds: ["l"] },
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
    { email: "a@b.co", clientId: "c", refreshToken: "r", listIds: ["l"] },
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
    { email: "a@b.co", clientId: "c", refreshToken: "r", listIds: ["l"] },
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

// ---------------------------------------------------------------------------
// Contact-form CRM record (spec 0032): multi-list subscribe + unsubscribed create.
// ---------------------------------------------------------------------------

test("buildSignUpPayload accepts multiple list memberships (blog + website contact)", () => {
  const p = buildSignUpPayload("reader@example.com", ["blog", "website"]);
  assert.deepEqual(p.list_memberships, ["blog", "website"]);
});

test("buildCreateContactPayload builds an unsubscribed contact on the given list(s)", () => {
  const p = buildCreateContactPayload("lead@example.com", ["website"], {
    firstName: "Ada",
    lastName: "Lovelace",
  });
  assert.deepEqual(p, {
    email_address: { address: "lead@example.com", permission_to_send: "unsubscribed" },
    create_source: "Contact",
    list_memberships: ["website"],
    first_name: "Ada",
    last_name: "Lovelace",
  });
});

test("buildCreateContactPayload omits first/last name when absent", () => {
  const p = buildCreateContactPayload("lead@example.com", ["website"]);
  assert.ok(!("first_name" in p) && !("last_name" in p));
  assert.equal(p.email_address.permission_to_send, "unsubscribed");
});

test("addUnsubscribedContact posts /contacts (create) with the unsubscribed body", async () => {
  let captured;
  const fakeFetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, status: 201, text: async () => "" };
  };
  await addUnsubscribedContact(
    { accessToken: "tok-xyz", email: "lead@example.com", listIds: ["website"] },
    fakeFetch,
  );
  assert.equal(captured.url, "https://api.cc.email/v3/contacts");
  assert.equal(captured.opts.method, "POST");
  assert.equal(captured.opts.headers.Authorization, "Bearer tok-xyz");
  const body = JSON.parse(captured.opts.body);
  assert.equal(body.email_address.address, "lead@example.com");
  assert.equal(body.email_address.permission_to_send, "unsubscribed");
  assert.deepEqual(body.list_memberships, ["website"]);
});

test("addUnsubscribedContact treats a 409 (already a contact) as a no-op success", async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 409,
    // A real 409 body echoes the contact id / email; prove we never throw it.
    text: async () => "Email already exists for contact abc: lead@example.com",
  });
  // Must NOT reject: an existing contact is left untouched, not an error.
  const res = await addUnsubscribedContact(
    { accessToken: "t", email: "lead@example.com", listIds: ["website"] },
    fakeFetch,
  );
  assert.equal(res.status, 409);
});

test("addUnsubscribedContact throws status-only on a non-2xx/non-409 (no PII)", async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 400,
    text: async () => "invalid: lead@example.com",
  });
  const err = await addUnsubscribedContact(
    { accessToken: "t", email: "lead@example.com", listIds: ["website"] },
    fakeFetch,
  ).then(
    () => {
      throw new Error("expected a rejection");
    },
    (e) => e,
  );
  assert.match(err.message, /create-contact responded 400/);
  assert.equal(err.status, 400);
  assert.ok(
    !/lead@example\.com/.test(err.message),
    "the error must not carry the response body / email (PII in logs)",
  );
});

test("recordWebsiteContact gets a token then creates the unsubscribed contact", async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (url.includes("/oauth2/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok", expires_in: 86400 }),
      };
    }
    return { ok: true, status: 201, text: async () => "" };
  };
  const cache = createTokenCache();
  await recordWebsiteContact(
    { email: "lead@example.com", name: "Ada Lovelace", clientId: "c", refreshToken: "r", listIds: ["website"] },
    { fetchImpl: fakeFetch, cache },
  );
  assert.equal(calls.length, 2, "a token call then a create-contact call");
  assert.match(calls[1], /\/v3\/contacts$/);
});

test("recordWebsiteContact resolves on a 409 (repeat sender is never an error)", async () => {
  const fakeFetch = async (url) => {
    if (url.includes("/oauth2/"))
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok", expires_in: 86400 }),
      };
    return { ok: false, status: 409, text: async () => "already exists" };
  };
  const cache = createTokenCache();
  await recordWebsiteContact(
    { email: "lead@example.com", clientId: "c", refreshToken: "r", listIds: ["website"] },
    { fetchImpl: fakeFetch, cache },
  );
  // Reaching here (no throw) is the assertion.
});
