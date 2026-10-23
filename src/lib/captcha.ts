/**
 * Pure, I/O-free core for the Cap captcha (spec 0043): challenge issuing,
 * challenge redemption, the single-use token we mint ourselves, and the
 * replay-prevention nonce store. Kept free of Next / request objects so it is
 * unit-tested without booting a server (the `app/v1/captcha/*` route handlers are
 * thin shells over this - the same testable-seam pattern as `src/lib/subscribe.ts`).
 * No secrets live here: `CAP_SECRET` is read from env in the routes and passed in.
 * `capjs-core`'s two entry points and the clock are injectable, so the tests never
 * touch a real library call or a real clock. There is no network call to inject:
 * Cap runs stateless and in-process, so this module is network-free by construction.
 *
 * TWO TOKENS, not one. `capjs-core` exports `generateChallenge` and
 * `validateChallenge` and nothing that re-verifies what `validateChallenge` hands
 * back, so the redeemed token is OURS: a compact HMAC over (scope, expiry, id),
 * keyed on `CAP_SECRET`, which `/v1/contact` verifies and spends exactly once.
 *
 * THREE OUTCOMES, not two. Every verdict is `valid`, `rejected`, or `errored`.
 * Only `rejected` is a real "this is a bot" verdict and the only one a caller may
 * turn into a 400. `errored` means OUR machinery is broken - a missing secret, a
 * library call that threw - and callers fail OPEN on it: let the submission
 * through, log loudly, and raise its own signal. A broken captcha that silently
 * ate every message is exactly the invisible failure feedback 0028 was written
 * about, so the distinction is deliberate and load-bearing.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  generateChallenge,
  validateChallenge,
  type Format1ChallengeResult,
  type ValidateChallengeBody,
} from "capjs-core";

/** Challenge scope for the contact form. Bound into the Cap token and ours. */
export const CAPTCHA_SCOPE_CONTACT = "contact";

/** How long a redeemed token stays spendable. Generous enough to finish typing. */
export const TOKEN_TTL_MS = 20 * 60 * 1000;

// Version prefix on our own token, so a future format change is distinguishable
// rather than silently mis-parsed. Bump it if the signed body ever changes shape.
const TOKEN_VERSION = "c1";

// Bound the parse of an attacker-supplied token. Ours is ~90 chars; anything
// wildly longer is not a truncated real token, it is someone probing.
const MAX_TOKEN_CHARS = 512;

/**
 * A verdict on a captcha token. `rejected` is the ONLY status that may become a
 * 400 - see the module comment on why `errored` must fail open instead.
 */
export type CaptchaResult =
  | { status: "valid" }
  | { status: "rejected"; reason: string }
  | { status: "errored"; error: string };

/** Replay guard: `consume` returns true the first time a key is seen, false after. */
export type NonceStore = {
  consume(key: string, ttlMs: number, now?: number): boolean;
};

/**
 * Best-effort in-process replay guard, mirroring `createRateLimiter`
 * (`./http-guards.ts`) in shape and limitations: state is lost on restart and is
 * not shared across replicas. The deploy is a single container and every key
 * carries a short TTL of its own (a challenge or token expiry), so the residual
 * exposure is a brief post-restart window in which one already-spent token could
 * be replayed - not an open door. Solving that properly means a persistent store,
 * which this repo deliberately does not have (spec 0043).
 *
 * Keys are namespaced by the caller (`challenge:` vs `token:`) so a redeemed Cap
 * signature and a minted token id can never collide.
 * @param maxKeys - size past which an expired-entry sweep runs
 */
export function createNonceStore({
  maxKeys = 10_000,
}: { maxKeys?: number } = {}): NonceStore {
  /** key -> epoch ms at which the entry stops blocking */
  const seen = new Map<string, number>();
  return {
    /** @returns true if newly consumed, false if it was already spent */
    consume(key: string, ttlMs: number, now: number = Date.now()): boolean {
      // Opportunistic sweep so the Map cannot grow without bound: once it is
      // large, drop every already-expired entry. Only runs on the rare oversized
      // path, so the common case stays O(1) - same trade the rate limiter makes.
      if (seen.size > maxKeys) {
        for (const [k, expiresAt] of seen) {
          if (expiresAt <= now) seen.delete(k);
        }
      }
      const expiresAt = seen.get(key);
      if (expiresAt !== undefined && expiresAt > now) return false;
      seen.set(key, now + Math.max(1, ttlMs));
      return true;
    },
  };
}

/** Narrow an unknown throw to a log-safe string. Never carries visitor input. */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

type Attempt<T> = { ok: true; value: T } | { ok: false; error: string };

async function attempt<T>(run: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

/**
 * A challenge ready to serve. `instrumentationError` is set when the browser
 * instrumentation layer could not be built and the challenge fell back to
 * proof-of-work only - the caller logs it and raises `captcha_unavailable`, but
 * still serves the challenge.
 */
export type ChallengeIssue =
  | {
      status: "ok";
      challenge: Format1ChallengeResult;
      instrumentationError?: string;
    }
  | { status: "errored"; error: string };

/**
 * Mint a challenge scoped to `scope`, with the browser-instrumentation layer on.
 * Instrumentation matters here specifically: proof-of-work only raises a bot's
 * cost, whereas executing a generated program against a real DOM is what actually
 * separates the scripted direct-to-endpoint POST this spec exists to stop.
 *
 * Building that program is the one part of generation that can fail on a trimmed
 * runtime (`capjs-core` compiles a fresh program per challenge and reaches for
 * esbuild to do it). If it fails we degrade to a proof-of-work-only challenge
 * rather than returning nothing: a pow-only challenge still solves, still redeems,
 * and still gates `/v1/contact`, so a broken layer costs protection instead of
 * costing every visitor their message.
 * @param generate - injectable `capjs-core.generateChallenge` seam for tests
 */
export async function issueChallenge(
  secret: string | undefined,
  {
    scope,
    generate = generateChallenge,
  }: { scope: string; generate?: typeof generateChallenge },
): Promise<ChallengeIssue> {
  if (!secret) return { status: "errored", error: "CAP_SECRET is not set" };
  const instrumented = await attempt(() =>
    generate(secret, { scope, instrumentation: true }),
  );
  // Format 1 is the default and the only format we ask for, so the union narrows
  // to the `{ challenge, token, expires }` shape the widget expects.
  if (instrumented.ok)
    return { status: "ok", challenge: instrumented.value as Format1ChallengeResult };
  const powOnly = await attempt(() => generate(secret, { scope }));
  if (powOnly.ok) {
    return {
      status: "ok",
      challenge: powOnly.value as Format1ChallengeResult,
      instrumentationError: instrumented.error,
    };
  }
  return { status: "errored", error: powOnly.error };
}

/**
 * The outcome of redeeming a solved challenge. `errored` still carries a token
 * whenever one could be minted: our machinery failed, not the visitor, so they
 * are handed a usable token and the fault is raised separately. A token is absent
 * only when there is no secret to sign with, in which case `/v1/contact` reaches
 * the same `errored` verdict on its own.
 */
export type RedeemResult =
  | { status: "valid"; token: string; expiresAtMs: number }
  | { status: "rejected"; reason: string }
  | { status: "errored"; error: string; token?: string; expiresAtMs?: number };

// `capjs-core` flags EVERY instrumentation failure with `instr_error`, but the
// list mixes two very different things. These two are faults on OUR side: the
// encrypted instrumentation blob would not decrypt (a secret rotated mid-flight),
// or it aged out. `nonce_store_error` is likewise ours - the replay store threw.
// Everything else in that family (`instr_missing`, `instr_timeout`,
// `instr_failed`, `instr_automated_browser`) is REPORTED BY THE CLIENT, so
// failing open on it would hand a scripted client a one-line bypass: claim a
// timeout, skip the DOM work entirely, collect a token. Those are verdicts, not
// faults, and they reject. A real visitor who trips one sees a retryable error
// (spec 0043 outcome), never a silent drop.
const OUR_FAULT_REASONS = new Set([
  "instr_corrupted",
  "instr_expired",
  "nonce_store_error",
]);

/** Random id for a minted token, injectable so tests get a stable value. */
function defaultTokenId(): string {
  return randomBytes(12).toString("base64url");
}

function signatureFor(secret: string, body: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

/**
 * Mint the compact single-use token `/v1/contact` will verify:
 * `c1.<scope>.<expiry ms>.<id>.<hmac>`. Dot-delimited rather than a JWT because
 * nothing here needs a JWT's negotiability - the only reader is the same process
 * holding the same secret. The id is what makes it single-use: `/v1/contact`
 * spends it through the nonce store.
 */
export function signCaptchaToken(
  secret: string,
  {
    scope,
    expiresAtMs,
    id,
  }: { scope: string; expiresAtMs: number; id: string },
): string {
  const body = `${TOKEN_VERSION}.${scope}.${expiresAtMs}.${id}`;
  return `${body}.${signatureFor(secret, body).toString("base64url")}`;
}

/**
 * Validate a solved challenge and, on success, mint our own token for it. The
 * `signToken` hook is what swaps Cap's opaque token for ours, so there is exactly
 * one token format crossing back to the client. `consumeNonce` is what makes a
 * solved challenge redeemable once - without it a stateless Cap deployment would
 * happily accept the same solution forever.
 * @param validate - injectable `capjs-core.validateChallenge` seam for tests
 */
export async function redeemChallenge(
  secret: string | undefined,
  body: unknown,
  {
    scope,
    store,
    validate = validateChallenge,
    now = Date.now,
    newId = defaultTokenId,
    tokenTtlMs = TOKEN_TTL_MS,
  }: {
    scope: string;
    store: NonceStore;
    validate?: typeof validateChallenge;
    now?: () => number;
    newId?: () => string;
    tokenTtlMs?: number;
  },
): Promise<RedeemResult> {
  if (!secret) return { status: "errored", error: "CAP_SECRET is not set" };
  const failOpenToken = () => {
    const expiresAtMs = now() + tokenTtlMs;
    return {
      token: signCaptchaToken(secret, { scope, expiresAtMs, id: newId() }),
      expiresAtMs,
    };
  };
  const attempted = await attempt(() =>
    validate(secret, body as ValidateChallengeBody, {
      scope,
      tokenTtlMs,
      consumeNonce: (signatureHex, ttlMs) =>
        store.consume(`challenge:${signatureHex}`, ttlMs, now()),
      signToken: ({ scope: tokenScope, expires }) =>
        signCaptchaToken(secret, {
          scope: tokenScope ?? scope,
          expiresAtMs: expires,
          id: newId(),
        }),
    }),
  );
  if (!attempted.ok)
    return { status: "errored", error: attempted.error, ...failOpenToken() };
  const result = attempted.value;
  if (result.success)
    return { status: "valid", token: result.token, expiresAtMs: result.expires };
  if (OUR_FAULT_REASONS.has(result.reason)) {
    return {
      status: "errored",
      error: result.error ?? result.reason,
      ...failOpenToken(),
    };
  }
  return { status: "rejected", reason: result.reason };
}

/**
 * Verify a token minted by `signCaptchaToken` and spend it. Signature first, so a
 * forged token learns nothing from the scope or expiry checks that follow, then
 * scope, then expiry, then single-use consumption.
 *
 * Returns `errored` - never `rejected` - when there is no secret to verify
 * against or the check itself throws, because a caller that turned those into a
 * 400 would silently reject every visitor the moment the secret went missing.
 * @param now - epoch ms, injectable so expiry is testable without a real clock
 */
export function verifyCaptchaToken(
  secret: string | undefined,
  token: unknown,
  {
    scope,
    store,
    now = Date.now(),
  }: { scope: string; store: NonceStore; now?: number },
): CaptchaResult {
  if (!secret) return { status: "errored", error: "CAP_SECRET is not set" };
  try {
    if (typeof token !== "string" || token.length === 0)
      return { status: "rejected", reason: "missing_token" };
    if (token.length > MAX_TOKEN_CHARS)
      return { status: "rejected", reason: "malformed_token" };
    const parts = token.split(".");
    if (parts.length !== 5 || parts[0] !== TOKEN_VERSION)
      return { status: "rejected", reason: "malformed_token" };
    const [, tokenScope, expiresRaw, id, providedSig] = parts;
    const expiresAtMs = Number(expiresRaw);
    if (!Number.isSafeInteger(expiresAtMs) || !id)
      return { status: "rejected", reason: "malformed_token" };
    const expected = signatureFor(
      secret,
      `${TOKEN_VERSION}.${tokenScope}.${expiresRaw}.${id}`,
    );
    const provided = Buffer.from(providedSig, "base64url");
    // timingSafeEqual throws on a length mismatch, so screen the length first
    // (a wrong length is public information - it leaks nothing about the key).
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
      return { status: "rejected", reason: "bad_signature" };
    if (tokenScope !== scope)
      return { status: "rejected", reason: "scope_mismatch" };
    if (expiresAtMs <= now) return { status: "rejected", reason: "expired" };
    if (!store.consume(`token:${id}`, expiresAtMs - now, now))
      return { status: "rejected", reason: "already_used" };
    return { status: "valid" };
  } catch (err) {
    return { status: "errored", error: describeError(err) };
  }
}
