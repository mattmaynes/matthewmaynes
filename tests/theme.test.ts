// Unit tests for the theme resolution logic - a named acceptance criterion in
// spec 0001 (system default + persisted override + no-flash pre-paint) that had
// no coverage (review feedback 0001). We test BOTH the pure `resolveDark` rule
// and the ACTUAL inline `themeScriptSource` string by running it against mocked
// browser globals, so the shipped pre-paint script is exercised, not a copy.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDark, themeScriptSource, applyStoredTheme } from "../src/lib/theme.ts";

// Run the real inline IIFE with stubbed localStorage/window/document and report
// whether it set the `.dark` class. Mirrors what the browser does pre-paint.
function runScript(stored, prefersDark) {
  let applied = null;
  const localStorage = { getItem: () => stored };
  const window = { matchMedia: () => ({ matches: prefersDark }) };
  const document = {
    documentElement: { classList: { toggle: (_cls, on) => { applied = on; } } },
  };
  // The script references bare `localStorage`/`window`/`document`; pass them as
  // params of the same name so they shadow any globals.
  new Function("localStorage", "window", "document", themeScriptSource)(
    localStorage,
    window,
    document,
  );
  return applied;
}

test("resolveDark: explicit stored choice wins over the OS setting", () => {
  assert.equal(resolveDark("dark", false), true); // stored dark beats OS light
  assert.equal(resolveDark("light", true), false); // stored light beats OS dark
});

test("resolveDark: falls back to the OS setting when no stored choice", () => {
  assert.equal(resolveDark(null, true), true);
  assert.equal(resolveDark(null, false), false);
  assert.equal(resolveDark("", true), true); // empty string is not a choice
});

test("pre-paint script applies the same rule as resolveDark", () => {
  for (const stored of [null, "", "dark", "light"]) {
    for (const prefersDark of [true, false]) {
      assert.equal(
        runScript(stored, prefersDark),
        resolveDark(stored, prefersDark),
        `script disagreed for stored=${JSON.stringify(stored)} prefersDark=${prefersDark}`,
      );
    }
  }
});

test("pre-paint script: stored 'dark' -> dark even when OS prefers light", () => {
  assert.equal(runScript("dark", false), true);
});

test("pre-paint script: no stored value -> follows OS", () => {
  assert.equal(runScript(null, true), true);
  assert.equal(runScript(null, false), false);
});

// applyStoredTheme is the JS twin of the inline script, used by boundaries that
// mount client-side (global-error) where the inline <script> never executes.
// Stub the browser globals it reads, run it, and assert it toggles `.dark` by the
// SAME rule. `localStorage`/`window`/`matchMedia` may throw one day; make sure it
// swallows that and that no DOM is a clean no-op.
function runApply(stored, prefersDark, { throwOnGet = false } = {}) {
  let applied = "unset";
  const prevDoc = globalThis.document;
  const prevLs = globalThis.localStorage;
  const prevWin = globalThis.window;
  globalThis.localStorage = {
    getItem: () => {
      if (throwOnGet) throw new Error("blocked by privacy mode");
      return stored;
    },
  };
  globalThis.window = { matchMedia: () => ({ matches: prefersDark }) };
  globalThis.document = {
    documentElement: { classList: { toggle: (_cls, on) => { applied = on; } } },
  };
  try {
    applyStoredTheme();
  } finally {
    globalThis.document = prevDoc;
    globalThis.localStorage = prevLs;
    globalThis.window = prevWin;
  }
  return applied;
}

test("applyStoredTheme toggles .dark by the same rule as resolveDark", () => {
  for (const stored of [null, "", "dark", "light"]) {
    for (const prefersDark of [true, false]) {
      assert.equal(
        runApply(stored, prefersDark),
        resolveDark(stored, prefersDark),
        `applyStoredTheme disagreed for stored=${JSON.stringify(stored)} prefersDark=${prefersDark}`,
      );
    }
  }
});

test("applyStoredTheme swallows a throwing localStorage (privacy mode)", () => {
  // Never toggled -> stayed at the sentinel, and did not throw.
  assert.equal(runApply(null, true, { throwOnGet: true }), "unset");
});

test("applyStoredTheme is a no-op without a DOM (SSR)", () => {
  const prevDoc = globalThis.document;
  // @ts-expect-error - deliberately removing the DOM to model the server.
  delete globalThis.document;
  try {
    assert.doesNotThrow(() => applyStoredTheme());
  } finally {
    globalThis.document = prevDoc;
  }
});
