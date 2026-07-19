import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/preview-auth";

/**
 * `GET /v1/logout` - clears the preview session cookie (spec 0036) and returns to
 * /blog. GET so it works as a plain link; the cookie is httpOnly, so this handler
 * is the only way to drop it. The `/v1/` prefix matches the other endpoints.
 */
export function GET(req: Request): Response {
  const res = NextResponse.redirect(new URL("/blog", req.url), 303);
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
