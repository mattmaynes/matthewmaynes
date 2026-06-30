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
  // WebP-only (NOT AVIF) on purpose. next/image optimizes on demand, so the first
  // visitor after each deploy pays the encode cost while the blur placeholder
  // shows. AVIF files are ~35% smaller but encode modestly slower per image
  // (measured ~0.05-0.12s/image here, more on the small deploy box) on top of a
  // one-time sharp init; the heavy lifting that made this slow was the oversized
  // PNG sources (now right-sized JPEG - see src/lib/site.ts). WebP is consistently
  // a touch faster to encode and universally supported, so it gives the snappiest
  // first paint at a negligible size cost. minimumCacheTTL is long because the
  // sources are content-hashed and immutable, so each variant is encoded once and
  // reused. (feedback 0006 - re-adding "image/avif" trades first-paint latency for
  // smaller files; only do it with deploy-time cache pre-warming.)
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 31536000,
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
