import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/preview-auth";

/**
 * Preview login gate (spec 0036), as a Next "proxy" (the successor to the
 * middleware convention). Gates ONLY the drafts INDEX at /blog/drafts, which
 * enumerates every not-yet-public post (drafts + scheduled previews from specs
 * 0034/0035) - that list should not leak, so an unauthenticated request is
 * redirected to /login. The session is a stateless HMAC of the shared
 * PREVIEW_PASSWORD (see preview-auth.ts), verified here with Web Crypto so no
 * session store is needed. Fail-closed: with PREVIEW_PASSWORD unset, verifySession
 * returns false, so the index is locked rather than leaked.
 *
 * The per-post preview PAGES (/blog/drafts/<slug>) are deliberately NOT gated here:
 * they self-gate their readable BODY at the page level while serving their OG
 * metadata publicly, so link-preview unfurling works (feedback 0022). The
 * per-post OG-image route is public for the same reason. Hence the matcher below
 * is the exact index only.
 */
export const config = {
  matcher: ["/blog/drafts"],
};

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (await verifySession(token, process.env.PREVIEW_PASSWORD)) {
    return NextResponse.next();
  }

  // Not authenticated: send to the login screen, remembering where to return.
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}
