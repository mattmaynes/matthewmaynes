import type { Metadata } from "next";
import { Button, Input } from "@/components/ui";
import { safeNext } from "@/lib/preview-auth";

// The preview gate's login screen (spec 0036). Not indexed - it is only reached by
// a redirect from the gated /blog/drafts area, and there is nothing to crawl.
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

// A plain server-rendered POST form (no client JS): it posts the password to
// /v1/login, which verifies it, sets the session cookie, and redirects back to
// `next`. One shared password, so no username field.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  // Sanitise here too so the round-tripped hidden field can never carry an
  // off-site target (the handler re-sanitises as well - defence in depth).
  const nextPath = safeNext(next);
  const showError = Boolean(error);
  // Generic messages only (no info leak): distinguish the rate-limit case so a
  // locked-out user knows to wait; everything else reads as a bad password.
  const errorMessage =
    error === "rate"
      ? "Too many attempts. Please wait a moment and try again."
      : "Incorrect password.";

  return (
    <section className="mx-auto max-w-md px-6 py-16 sm:py-24">
      <h1 className="text-h1 font-bold text-text">Sign in</h1>
      <p className="mt-4 text-body text-text-muted">
        This area holds unpublished and scheduled posts. Enter the password to
        preview them.
      </p>

      <form method="POST" action="/v1/login" className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="next" value={nextPath} />
        <label className="flex flex-col gap-2">
          <span className="text-caption font-medium text-text">Password</span>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={showError || undefined}
            aria-describedby={showError ? "password-error" : undefined}
          />
        </label>
        {showError ? (
          <p id="password-error" role="alert" className="text-caption text-danger">
            {errorMessage}
          </p>
        ) : null}
        <Button type="submit">Unlock</Button>
      </form>
    </section>
  );
}
