// Unit tests for the theme resolution logic - a named acceptance criterion in
// spec 0001 (system default + persisted override + no-flash pre-paint) that had
// no coverage (review feedback 0001). We test BOTH the pure `resolveDark` rule
// and the ACTUAL inline `themeScriptSource` string by running it against mocked
// browser globals, so the shipped pre-paint script is exercised, not a copy.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDark, themeScriptSource } from "../src/lib/theme.js";

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
