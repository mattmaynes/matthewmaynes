import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
