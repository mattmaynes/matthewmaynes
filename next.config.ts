import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the file-tracing root to this project so `output: standalone` always
  // emits server.js at `.next/standalone/server.js`. Without it, a second
  // lockfile in the nested `.worktrees/` checkout makes Next infer the OUTER
  // repo as the workspace root and nest server.js, breaking the smoke test and
  // the resume PDF generator (both boot the standalone server). No-op in CI and
  // Docker, where the app is the only root. (learnings 0002)
  outputFileTracingRoot: import.meta.dirname,
  // Serve AVIF first (then WebP) so the heavy PNG sources ship far fewer bytes
  // and decode sooner; the default is WebP-only. Static-imported images also
  // carry a build-time blurDataURL for placeholder="blur" (see src/lib/site.ts).
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Conservative baseline security headers for a public static-content site.
  // No CSP yet: the pre-paint theme script is inline, so a future CSP must use a
  // hash/nonce rather than 'unsafe-inline' (tracked for a later spec).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
