import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/preview-auth";

/**
 * `GET /v1/logout` - clears the preview session cookie (spec 0036) and returns to
 * /blog. GET so it works as a plain link; the cookie is httpOnly, so this handler
 * is the only way to drop it. The `/v1/` prefix matches the other endpoints.
 *
 * The Location is RELATIVE on purpose: behind the Caddy proxy `req.url`'s host is
 * the container's internal 0.0.0.0:3000 bind, so an absolute redirect from it would
 * send the browser to an unreachable URL (feedback 0021).
 */
export function GET(): Response {
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: "/blog" },
  });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
