import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/preview-auth";

/**
 * Preview login gate (spec 0036), as a Next "proxy" (the successor to the
 * middleware convention). Gates the not-yet-public area at /blog/drafts (drafts +
 * scheduled previews from specs 0034/0035): a request without a valid session
 * cookie is redirected to /login. The session is a stateless HMAC of the shared
 * PREVIEW_PASSWORD (see preview-auth.ts), verified here with Web Crypto so no
 * session store is needed. Fail-closed: with PREVIEW_PASSWORD unset, verifySession
 * returns false, so previews are locked rather than leaked.
 */

// Match the drafts index and every nested preview route. The OG-image sub-route is
// let through in code below (a matcher exclusion regex is brittle).
export const config = {
  matcher: ["/blog/drafts", "/blog/drafts/:path*"],
};

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Keep preview OG cards PUBLIC (spec 0036) so link-preview unfurling still works;
  // only the readable HTML pages are gated. The published post's own OG card is
  // separately gated by isPublishedNow (spec 0035), so a scheduled post's card is
  // reachable only here, which is the accepted, bounded exposure.
  if (pathname.endsWith("/opengraph-image")) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (await verifySession(token, process.env.PREVIEW_PASSWORD)) {
    return NextResponse.next();
  }

  // Not authenticated: send to the login screen, remembering where to return.
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
