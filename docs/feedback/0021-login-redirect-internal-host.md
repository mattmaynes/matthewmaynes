# 0021 - Login redirect sent the browser to the container's internal host

## Symptom

After deploying the preview login gate (spec 0036) and setting `PREVIEW_PASSWORD`, a correct login
set the session cookie but redirected the browser to `https://0.0.0.0:3000/blog/drafts` - an
unreachable URL. Same for the wrong-password redirect (`https://0.0.0.0:3000/login?error=1`) and the
logout redirect. The gate's OWN redirect (the proxy sending an unauthenticated visitor to `/login`)
was correct; only the `/v1/login` and `/v1/logout` route handlers were broken.

## Root cause

The route handlers built their redirect target with `new URL(path, req.url)` and
`NextResponse.redirect(...)`. Behind the Caddy reverse proxy, `req.url` in a Route Handler carries the
container's INTERNAL bind host (`0.0.0.0:3000`), not the public `matthewmaynes.com` the browser
connected to - so the absolute Location pointed at the internal address. The proxy (middleware) got it
right because `NextRequest.nextUrl` there honours `x-forwarded-host`; Route Handlers' `req.url` does not.

The local smoke test missed it: it hits `127.0.0.1:PORT` directly with NO proxy, so `req.url`'s host
equals the request host and an absolute redirect looks correct. The assertion also used
`/\/blog\/drafts$/`, which an absolute internal-host URL still satisfies.

## Fix

Emit a RELATIVE `Location` (`/blog/drafts`, `/login?error=...`, `/blog`) via
`new NextResponse(null, { status: 303, headers: { Location } })` instead of an absolute URL built from
`req.url`. The browser resolves a relative Location against the origin it actually connected to, so it
is proxy-correct with no host-header trust; `safeNext` still constrains the target to a same-origin
path. Tightened the smoke tests to assert the Location is exactly the relative path (equality /
`startsWith("/login?")`), and added a logout test - so a regression to an absolute redirect fails.

## Learning

Generalises to `overview/learnings.md`: **build redirects/absolute links from a relative path or the
forwarded host, never from `req.url` in a Route Handler** - behind a reverse proxy `req.url` is the
internal container host, so an absolute redirect points somewhere the browser cannot reach. And a
smoke test that runs WITHOUT the proxy cannot catch a proxy-host bug unless it asserts the Location is
relative (or host-correct), not just that it ends with the right path.
