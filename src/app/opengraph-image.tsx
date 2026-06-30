import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { site } from "@/lib/site";

// Needs the Node runtime to read the logo + font files off disk.
export const runtime = "nodejs";

// The branded card crawlers render for the link preview. Same metal M as the
// favicon, so the tab icon and the share card are visibly one brand.
export const alt = site.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Harbor-dark palette (see src/styles/theme-harbor.css).
const BG_FROM = "#1f3447"; // harbor-900
const BG_TO = "#14222f"; // slate-950
const TEXT = "#f6f7f9"; // slate-50
const ACCENT = "#82a6c8"; // harbor-300
const SUBTLE = "#b0c8de"; // harbor-200
const WARM = "#cf9343"; // accent (gold) - the brand's warm note

// Fonts: Figtree woff colocated in _og/ (satori cannot read the woff2 that
// @fontsource-variable ships; the static @fontsource/figtree woff works).
// scripts/build-og-fonts.mjs derives them from the pinned package.
// `new URL(..., import.meta.url)` makes them traced assets so they survive the
// standalone build. The logo reads from public/, which the Dockerfile/standalone
// copy step deploys alongside server.js.
async function loadAssets() {
  const [regular, semibold, bold, logo] = await Promise.all([
    readFile(new URL("./_og/figtree-400.woff", import.meta.url)),
    readFile(new URL("./_og/figtree-600.woff", import.meta.url)),
    readFile(new URL("./_og/figtree-700.woff", import.meta.url)),
    readFile(join(process.cwd(), "public/brand/logo-m.png")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  return { regular, semibold, bold, logoSrc };
}

export default async function OpengraphImage() {
  const { regular, semibold, bold, logoSrc } = await loadAssets();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "90px",
          backgroundImage: `linear-gradient(135deg, ${BG_FROM}, ${BG_TO})`,
          fontFamily: "Figtree",
        }}
      >
        <img src={logoSrc} width={150} height={150} alt="" />
        {/* Warm gold rule: the brand's one warm note against the cool harbor
            field, so the most-shared asset reads inviting, not corporate-cold. */}
        <div
          style={{
            width: 72,
            height: 6,
            borderRadius: 3,
            backgroundColor: WARM,
            marginTop: 40,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            color: TEXT,
            marginTop: 28,
            letterSpacing: "-0.02em",
          }}
        >
          {site.name}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 38,
            fontWeight: 600,
            color: ACCENT,
            marginTop: 8,
          }}
        >
          {site.title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 400,
            color: SUBTLE,
            marginTop: 28,
          }}
        >
          {site.tagline}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Figtree", data: regular, weight: 400, style: "normal" },
        { name: "Figtree", data: semibold, weight: 600, style: "normal" },
        { name: "Figtree", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
