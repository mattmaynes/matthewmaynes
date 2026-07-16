// Unit tests for the stale-deploy chunk recovery (src/lib/chunk-recovery.ts):
// the ChunkLoadError signature detection and the guarded one-shot reload. No
// browser - a tiny mock window stands in for location/sessionStorage. Runs via
// `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isChunkLoadError,
  recoverFromChunkError,
  RELOAD_GUARD_KEY,
  RELOAD_GUARD_MS,
} from "../src/lib/chunk-recovery.ts";

test("isChunkLoadError matches the stale-deploy signatures", () => {
  assert.equal(isChunkLoadError({ name: "ChunkLoadError" }), true);
  assert.equal(isChunkLoadError({ message: "Loading chunk 42 failed" }), true);
  assert.equal(
    isChunkLoadError({ message: "Loading chunk app-a1b2c3 failed after 3 tries" }),
    true,
  );
  assert.equal(isChunkLoadError({ message: "Loading CSS chunk 7 failed" }), true);
  assert.equal(
    isChunkLoadError({ message: "Failed to fetch dynamically imported module: /x.js" }),
    true,
  );
  assert.equal(
    isChunkLoadError({ message: "error loading dynamically imported module" }),
    true,
  );
});

test("isChunkLoadError ignores unrelated errors and junk", () => {
  assert.equal(isChunkLoadError(new TypeError("cannot read x of undefined")), false);
  assert.equal(isChunkLoadError({ message: "network timeout" }), false);
  assert.equal(isChunkLoadError(null), false);
  assert.equal(isChunkLoadError(undefined), false);
  assert.equal(isChunkLoadError("ChunkLoadError"), false); // a bare string has no name/message
});

/** Minimal window stand-in: records reload() calls and a real-ish sessionStorage. */
function mockWindow(store: Record<string, string> = {}) {
  let reloads = 0;
  return {
    reloads: () => reloads,
    win: {
      location: { reload: () => { reloads++; } },
      sessionStorage: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = v; },
      },
    } as unknown as Window & typeof globalThis,
  };
}

test("recoverFromChunkError reloads once for a chunk error and records the guard", () => {
  const { win, reloads } = mockWindow();
  const handled = recoverFromChunkError({ name: "ChunkLoadError" }, win, 1000);
  assert.equal(handled, true);
  assert.equal(reloads(), 1);
  assert.equal(
    win.sessionStorage.getItem(RELOAD_GUARD_KEY),
    "1000",
    "records the attempt time so a second call can bail",
  );
});

test("recoverFromChunkError does not reload for a non-chunk error", () => {
  const { win, reloads } = mockWindow();
  const handled = recoverFromChunkError(new Error("boom"), win, 1000);
  assert.equal(handled, false);
  assert.equal(reloads(), 0);
});

test("recoverFromChunkError will not loop: a second chunk error within the window is ignored", () => {
  const store: Record<string, string> = {};
  const first = mockWindow(store);
  assert.equal(recoverFromChunkError({ name: "ChunkLoadError" }, first.win, 1000), true);
  // A fresh window (as after the reload) sharing the same session storage, still
  // inside the guard window -> must NOT reload again, so the fallback UI shows.
  const second = mockWindow(store);
  const handled = recoverFromChunkError(
    { name: "ChunkLoadError" },
    second.win,
    1000 + RELOAD_GUARD_MS - 1,
  );
  assert.equal(handled, false);
  assert.equal(second.reloads(), 0);
});

test("recoverFromChunkError reloads again once the guard window has passed", () => {
  const store: Record<string, string> = { [RELOAD_GUARD_KEY]: "1000" };
  const { win, reloads } = mockWindow(store);
  const handled = recoverFromChunkError(
    { name: "ChunkLoadError" },
    win,
    1000 + RELOAD_GUARD_MS + 1,
  );
  assert.equal(handled, true);
  assert.equal(reloads(), 1);
});
