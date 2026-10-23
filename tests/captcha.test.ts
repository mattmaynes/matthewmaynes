// Unit tests for the captcha core (src/lib/captcha.ts): the replay store, the
// single-use token we mint and verify ourselves, challenge issuing, and challenge
// redemption. capjs-core's two entry points are injected, and so is the clock, so
// nothing here calls the real library, touches the network, or waits on time.
//
// The load-bearing assertions are the ones separating `rejected` from `errored`:
// only `rejected` may become a 400, and every infrastructure fault must fail open
// instead (feedback 0028 - a guard that silently eats real submissions is worse
// than no guard).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAPTCHA_SCOPE_CONTACT,
  createNonceStore,
  issueChallenge,
  redeemChallenge,
  signCaptchaToken,
  verifyCaptchaToken,
} from "../src/lib/captcha.ts";

const SECRET = "test-secret-at-least-16-bytes-long";

// A token minted the way redeem mints one, for the verify tests.
function mint({
  scope = CAPTCHA_SCOPE_CONTACT,
  expiresAtMs = 10_000,
  id = "id-1",
  secret = SECRET,
} = {}) {
  return signCaptchaToken(secret, { scope, expiresAtMs, id });
}

function verify(token: unknown, { store = createNonceStore(), now = 0 } = {}) {
  return verifyCaptchaToken(SECRET, token, {
    scope: CAPTCHA_SCOPE_CONTACT,
    store,
    now,
  });
}

test("createNonceStore consumes a key once, then refuses it until it expires", () => {
  const store = createNonceStore();
  assert.equal(store.consume("k", 1000, 0), true);
  assert.equal(store.consume("k", 1000, 500), false, "a replay inside the ttl must fail");
  assert.equal(store.consume("k", 1000, 1001), true, "past the ttl the key is free again");
  assert.equal(store.consume("other", 1000, 500), true, "keys are independent");
});

test("createNonceStore sweeps expired keys once it is oversized", () => {
  const store = createNonceStore({ maxKeys: 2 });
  store.consume("a", 100, 0);
  store.consume("b", 100, 0);
  store.consume("c", 100, 0);
  // Past every ttl, the next call is oversized and sweeps, so "a" is gone rather
  // than held forever - the Map cannot grow without bound.
  assert.equal(store.consume("d", 100, 500), true);
  assert.equal(store.consume("a", 100, 500), true);
});

test("verifyCaptchaToken accepts a freshly minted token", () => {
  assert.deepEqual(verify(mint()), { status: "valid" });
});

test("verifyCaptchaToken rejects a missing or unparseable token", () => {
  for (const bad of [undefined, null, "", 42, {}, "not-a-token", "c1.a.b.c"]) {
    const result = verify(bad);
    assert.equal(result.status, "rejected", `expected ${String(bad)} to be rejected`);
  }
  assert.equal(verify(undefined).reason, "missing_token");
  assert.equal(verify("c1.a.b.c").reason, "malformed_token");
});

test("verifyCaptchaToken rejects a tampered signature and a foreign secret", () => {
  const token = mint();
  const tampered = token.slice(0, -4) + "AAAA";
  assert.equal(verify(tampered).reason, "bad_signature");
  const foreign = mint({ secret: "another-secret-at-least-16-bytes" });
  assert.equal(verify(foreign).reason, "bad_signature");
});

test("verifyCaptchaToken rejects another form's scope", () => {
  assert.equal(verify(mint({ scope: "subscribe" })).reason, "scope_mismatch");
});

test("verifyCaptchaToken rejects an expired token", () => {
  assert.equal(verify(mint({ expiresAtMs: 1000 }), { now: 1000 }).reason, "expired");
  assert.equal(verify(mint({ expiresAtMs: 1000 }), { now: 999 }).status, "valid");
});

test("verifyCaptchaToken spends a token exactly once", () => {
  const store = createNonceStore();
  const token = mint();
  assert.equal(verify(token, { store }).status, "valid");
  assert.equal(verify(token, { store }).reason, "already_used");
});

test("verifyCaptchaToken FAILS OPEN when there is no secret to verify against", () => {
  const result = verifyCaptchaToken(undefined, mint(), {
    scope: CAPTCHA_SCOPE_CONTACT,
    store: createNonceStore(),
    now: 0,
  });
  // Not "rejected": a missing secret would otherwise 400 every real visitor.
  assert.equal(result.status, "errored");
  assert.match(result.error, /CAP_SECRET/);
});

test("verifyCaptchaToken FAILS OPEN when the replay store throws", () => {
  const store = {
    consume() {
      throw new Error("store is on fire");
    },
  };
  const result = verifyCaptchaToken(SECRET, mint(), {
    scope: CAPTCHA_SCOPE_CONTACT,
    store,
    now: 0,
  });
  assert.equal(result.status, "errored");
  assert.equal(result.error, "store is on fire");
});

const FAKE_CHALLENGE = { challenge: { c: 1, s: 2, d: 3 }, token: "cap-token", expires: 99 };

test("issueChallenge asks for the instrumentation layer and passes the scope", async () => {
  const calls = [];
  const generate = async (secret, opts) => {
    calls.push({ secret, opts });
    return FAKE_CHALLENGE;
  };
  const issued = await issueChallenge(SECRET, {
    scope: CAPTCHA_SCOPE_CONTACT,
    generate,
  });
  assert.equal(issued.status, "ok");
  assert.equal(issued.challenge, FAKE_CHALLENGE);
  assert.equal(issued.instrumentationError, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].secret, SECRET);
  assert.equal(calls[0].opts.scope, CAPTCHA_SCOPE_CONTACT);
  assert.equal(calls[0].opts.instrumentation, true);
});

test("issueChallenge degrades to proof-of-work only when instrumentation cannot be built", async () => {
  const attempts = [];
  const generate = async (_secret, opts) => {
    attempts.push(opts.instrumentation);
    if (opts.instrumentation) throw new Error("esbuild is missing");
    return FAKE_CHALLENGE;
  };
  const issued = await issueChallenge(SECRET, {
    scope: CAPTCHA_SCOPE_CONTACT,
    generate,
  });
  // Still a usable challenge: a dead instrumentation layer costs protection, not
  // every visitor's message.
  assert.equal(issued.status, "ok");
  assert.equal(issued.instrumentationError, "esbuild is missing");
  assert.deepEqual(attempts, [true, undefined]);
});

test("issueChallenge reports errored when generation fails outright or has no secret", async () => {
  const generate = async () => {
    throw new Error("nope");
  };
  const failed = await issueChallenge(SECRET, {
    scope: CAPTCHA_SCOPE_CONTACT,
    generate,
  });
  assert.equal(failed.status, "errored");
  assert.equal(failed.error, "nope");

  const unset = await issueChallenge("", { scope: CAPTCHA_SCOPE_CONTACT, generate });
  assert.equal(unset.status, "errored");
  assert.match(unset.error, /CAP_SECRET/);
});

// A stand-in for capjs-core's validateChallenge that honours the two hooks the
// module relies on: the replay store and our own token minting.
function fakeValidate(outcome) {
  return async (_secret, _body, opts) => {
    if (opts.consumeNonce && !(await opts.consumeNonce("sig-1", 1000)))
      return { success: false, reason: "already_redeemed" };
    if (outcome.success) {
      const expires = 12_345;
      return {
        success: true,
        token: await opts.signToken({ scope: CAPTCHA_SCOPE_CONTACT, expires }),
        expires,
        scope: CAPTCHA_SCOPE_CONTACT,
      };
    }
    return outcome;
  };
}

const redeemOpts = (extra = {}) => ({
  scope: CAPTCHA_SCOPE_CONTACT,
  store: createNonceStore(),
  now: () => 0,
  newId: () => "minted-id",
  ...extra,
});

test("redeemChallenge mints a token /v1/contact accepts", async () => {
  const result = await redeemChallenge(
    SECRET,
    {},
    redeemOpts({ validate: fakeValidate({ success: true }) }),
  );
  assert.equal(result.status, "valid");
  assert.equal(result.expiresAtMs, 12_345);
  assert.deepEqual(verify(result.token, { now: 0 }), { status: "valid" });
});

test("redeemChallenge refuses a challenge that was already redeemed", async () => {
  const store = createNonceStore();
  const validate = fakeValidate({ success: true });
  const first = await redeemChallenge(SECRET, {}, redeemOpts({ validate, store }));
  assert.equal(first.status, "valid");
  const replay = await redeemChallenge(SECRET, {}, redeemOpts({ validate, store }));
  assert.equal(replay.status, "rejected");
  assert.equal(replay.reason, "already_redeemed");
});

test("redeemChallenge rejects a bad solution and every client-reported verdict", async () => {
  // `instr_*` reasons carry instr_error, but these are reported BY the browser -
  // failing open on them would let a script claim a timeout and skip the work.
  for (const reason of [
    "invalid_solution",
    "expired",
    "scope_mismatch",
    "instr_missing",
    "instr_timeout",
    "instr_failed",
    "instr_automated_browser",
  ]) {
    const result = await redeemChallenge(
      SECRET,
      {},
      redeemOpts({
        validate: fakeValidate({ success: false, reason, instr_error: true }),
      }),
    );
    assert.equal(result.status, "rejected", `${reason} must reject`);
    assert.equal(result.reason, reason);
  }
});

test("redeemChallenge FAILS OPEN on our own instrumentation faults", async () => {
  for (const reason of ["instr_corrupted", "instr_expired", "nonce_store_error"]) {
    const result = await redeemChallenge(
      SECRET,
      {},
      redeemOpts({
        validate: fakeValidate({ success: false, reason, instr_error: true }),
      }),
    );
    assert.equal(result.status, "errored", `${reason} must fail open`);
    // The visitor still gets a usable token: our machinery broke, not their solve.
    assert.deepEqual(verify(result.token, { now: 0 }), { status: "valid" });
  }
});

test("redeemChallenge FAILS OPEN when the library call throws", async () => {
  const validate = async () => {
    throw new Error("capjs blew up");
  };
  const result = await redeemChallenge(SECRET, {}, redeemOpts({ validate }));
  assert.equal(result.status, "errored");
  assert.equal(result.error, "capjs blew up");
  assert.deepEqual(verify(result.token, { now: 0 }), { status: "valid" });
});

test("redeemChallenge with no secret is errored and mints nothing", async () => {
  const result = await redeemChallenge(
    undefined,
    {},
    redeemOpts({ validate: fakeValidate({ success: true }) }),
  );
  assert.equal(result.status, "errored");
  assert.equal(result.token, undefined);
  assert.match(result.error, /CAP_SECRET/);
});
