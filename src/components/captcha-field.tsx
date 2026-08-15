"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CapProgressEvent, CapSolveEvent, CapWidget } from "cap-widget";

/**
 * The visible "I'm not a robot" control (spec 0043). A `"use client"` island that
 * mounts Cap's `<cap-widget>` custom element, lets it solve the proof-of-work and
 * browser-instrumentation challenge against `/v1/captcha/*`, and reports the
 * resulting single-use token up to the form.
 *
 * Visible on purpose. The challenge is generated server-side, so a checkbox and a
 * headless solve run the identical puzzle - the control buys no extra protection.
 * What it buys is honesty about latency: the proof-of-work takes real time, and
 * someone who has just written a long message deserves a progress reading, a
 * retryable error, and something a screen reader can announce, rather than an
 * unexplained pause before Send comes alive.
 *
 * The widget is a web component, so it is created imperatively rather than in
 * JSX - React hands off the subtree and only listens to its events.
 */

// The widget appends `challenge` and `redeem` to this, hence the trailing slash.
const API_ENDPOINT = "/v1/captcha/";

// Serve the proof-of-work solver from our own origin (see the route's comment):
// left to itself the widget fetches it from a public CDN at load time, which
// would be the site's only third-party request.
const WASM_URL = "/v1/captcha/wasm";

// Same again for the widget's `pako` fallback, injected as a script tag from a CDN
// on a browser with no `DecompressionStream`. Rarely taken, so it has to be set
// unconditionally - by the time we could tell it was needed it would be too late.
const PAKO_URL = "/v1/captcha/pako";

/**
 * What the form needs from the control. `ready` gates Send. A `null` token with
 * `ready: true` means the captcha is unavailable server-side - the submission
 * goes ahead untokened and `/v1/contact` fails open rather than swallowing a
 * message nobody could have got past a check that could not run.
 */
export type CaptchaGate = { ready: false } | { ready: true; token: string | null };

type Status =
  | { kind: "idle" }
  | { kind: "solving"; progress: number }
  | { kind: "solved" }
  | { kind: "error" }
  | { kind: "unavailable" };

export function CaptchaField({
  onChange,
  resetSignal = 0,
}: {
  /** Called whenever the gate changes: unsolved, solved, or unavailable. */
  onChange: (gate: CaptchaGate) => void;
  /** Bump to clear a spent token - the token is single-use, so a second send
   *  needs a fresh challenge. */
  resetSignal?: number;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<CapWidget | null>(null);

  // Held in a ref so the widget's long-lived listeners and the global fetch hook
  // always call the current callback without being torn down and rebuilt.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const markUnavailable = useCallback(() => {
    setStatus({ kind: "unavailable" });
    onChangeRef.current({ ready: true, token: null });
  }, []);

  useEffect(() => {
    let cancelled = false;

    // All three globals must be in place BEFORE the widget module evaluates: it
    // kicks off the wasm fetch at import time, and the fetch and pako hooks are
    // read per call - the pako one only once a challenge is already in flight.
    window.CAP_CUSTOM_WASM_URL = WASM_URL;
    window.CAP_PAKO_URL = PAKO_URL;
    window.CAP_CUSTOM_FETCH = async (input, init) => {
      const res = await fetch(input, init);
      // The widget owns these requests, so this is the only place the client can
      // see the server saying "the captcha is unavailable". Peek at a clone so
      // the widget still gets an unread body.
      res
        .clone()
        .json()
        .then((body) => {
          if (body?.captchaUnavailable) markUnavailable();
        })
        .catch(() => {});
      return res;
    };

    const host = hostRef.current;
    import("cap-widget")
      .then(() => {
        if (cancelled || !host) return;
        const widget = document.createElement("cap-widget");
        widget.setAttribute("data-cap-api-endpoint", API_ENDPOINT);
        widget.addEventListener("progress", (event: CapProgressEvent) => {
          setStatus({ kind: "solving", progress: Math.round(event.detail.progress) });
        });
        widget.addEventListener("solve", (event: CapSolveEvent) => {
          setStatus({ kind: "solved" });
          onChangeRef.current({ ready: true, token: event.detail.token });
        });
        widget.addEventListener("error", () => {
          setStatus({ kind: "error" });
          onChangeRef.current({ ready: false });
        });
        widget.addEventListener("reset", () => {
          setStatus({ kind: "idle" });
          onChangeRef.current({ ready: false });
        });
        widgetRef.current = widget;
        host.appendChild(widget);
      })
      .catch((err) => {
        // The widget bundle itself failed to load. Nothing the visitor can do
        // about it, and blocking Send would lose their message, so treat it the
        // same as the server saying the captcha is down.
        console.error("captcha: could not load the widget:", err);
        if (!cancelled) markUnavailable();
      });

    return () => {
      cancelled = true;
      widgetRef.current?.remove();
      widgetRef.current = null;
    };
  }, [markUnavailable]);

  // A sent message spends the token, so re-arm the widget for the next one.
  useEffect(() => {
    if (resetSignal === 0) return;
    widgetRef.current?.reset();
  }, [resetSignal]);

  const retry = () => {
    setStatus({ kind: "idle" });
    onChangeRef.current({ ready: false });
    widgetRef.current?.reset();
  };

  // The captcha is down: say nothing and let them send. The fault is already an
  // error log and a `captcha_unavailable` event on the server.
  if (status.kind === "unavailable") return null;

  let note = null;
  if (status.kind === "solving") {
    note = (
      <p role="status" className="text-caption text-text-muted">
        Checking you are human... {status.progress}%
      </p>
    );
  }
  if (status.kind === "error") {
    note = (
      <p role="alert" className="text-caption text-danger">
        That check did not finish.{" "}
        <button type="button" onClick={retry} className="underline">
          Try again
        </button>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={hostRef} />
      {note}
    </div>
  );
}
