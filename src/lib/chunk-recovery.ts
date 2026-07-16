/**
 * Stale-deploy chunk recovery.
 *
 * Content-hashed JS/CSS chunks are renamed on every deploy. A tab left open
 * across a deploy still references the OLD hashes, so the next client-side
 * navigation requests a chunk the server no longer has - it 404s and surfaces as
 * a `ChunkLoadError`, which our error boundary would otherwise render as a dead
 * "Something went wrong" page. The right recovery is a single full reload: it
 * re-fetches the current HTML, which points at the fresh chunk names.
 *
 * Framework-free so both `app/error.tsx` and `app/global-error.tsx` share it and
 * it can be unit-tested against a mock window (`tests/chunk-recovery.test.ts`).
 */

/**
 * True when `error` looks like a chunk/module that failed to load - the
 * signature of a stale build after a deploy. Covers webpack's `ChunkLoadError`,
 * its "Loading chunk N failed" / "Loading CSS chunk" messages, and the native
 * dynamic-import failures browsers word differently.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  const n = typeof name === "string" ? name : "";
  const m = typeof message === "string" ? message : "";
  return (
    n === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(m) ||
    /Loading CSS chunk/i.test(m) ||
    /Failed to fetch dynamically imported module/i.test(m) ||
    /error loading dynamically imported module/i.test(m) ||
    /'?importing a module script failed/i.test(m)
  );
}

/** sessionStorage key + window guarding the one-shot reload against a loop. */
export const RELOAD_GUARD_KEY = "chunk-reload-at";
export const RELOAD_GUARD_MS = 10_000;

/**
 * If `error` is a stale-chunk error, force ONE full reload to the fresh build and
 * return true; otherwise return false and let the caller show its fallback. The
 * reload is guarded by a sessionStorage timestamp so a chunk that is genuinely
 * gone (e.g. the reload also fails) cannot loop - after the first attempt within
 * the window we fall through to the fallback UI instead.
 */
export function recoverFromChunkError(
  error: unknown,
  win: Window & typeof globalThis = window,
  now: number = Date.now(),
): boolean {
  if (!isChunkLoadError(error)) return false;
  try {
    // Absent key = never attempted -> always reload. A stored timestamp inside the
    // window = we just tried and it did not help -> bail to the fallback. (Kept
    // distinct from 0 so a real early timestamp cannot masquerade as "no attempt".)
    const raw = win.sessionStorage.getItem(RELOAD_GUARD_KEY);
    const last = raw === null ? null : Number(raw);
    if (last !== null && Number.isFinite(last) && now - last < RELOAD_GUARD_MS) {
      return false; // already tried this window; avoid a reload loop
    }
    win.sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
  } catch {
    // sessionStorage blocked: fall through to a single best-effort reload. Without
    // a guard we accept a small loop risk over never recovering.
  }
  win.location.reload();
  return true;
}
