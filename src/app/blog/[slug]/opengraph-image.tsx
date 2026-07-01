import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { site } from "@/lib/site";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";

// Needs the Node runtime to read the cover + font files off disk.
export const runtime = "nodejs";

export const alt = "Blog post on matthewmaynes.com";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Bake one card per post at build so this route is static, rather than reading
// content/ per request and relying on Next file-tracing to have copied it.
export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

// Harbor-dark palette (see src/styles/theme-harbor.css), matching the site card.
const BG_FROM = "#1f3447"; // harbor-900
const BG_TO = "#14222f"; // slate-950
const MAT = "#0c1218"; // near-black mat behind the cover art
const TEXT = "#f6f7f9"; // slate-50
const ACCENT = "#82a6c8"; // harbor-300
const WARM = "#cf9343"; // accent (gold)

// Fonts: Figtree woff colocated in src/app/_og/, loaded via new URL(...,
// import.meta.url) so they are traced into the standalone build (learnings 0004,
// same pattern as the site opengraph-image).
async function loadFonts() {
  const [regular, semibold, bold] = await Promise.all([
    readFile(new URL("../../_og/figtree-400.woff", import.meta.url)),
    readFile(new URL("../../_og/figtree-600.woff", import.meta.url)),
    readFile(new URL("../../_og/figtree-700.woff", import.meta.url)),
  ]);
  return { regular, semibold, bold };
}

// Read the cover from public/ (the standalone copy step deploys public/ next to
// server.js, so join(process.cwd(), "public/...") resolves), returning a data
// URL plus an integer-scaled size that fits the card without stretching. Pixel
// art is scaled by a whole number so it stays crisp.
async function loadCover(coverKey: string) {
  const meta = getBlogImage(coverKey);
  if (!meta) return null;
  // getBlogImage tolerates a missing ".png"; read the same normalized filename
  // so a bare cover key (no extension) does not ENOENT and 500 the route.
  const filename = coverKey.endsWith(".png") ? coverKey : `${coverKey}.png`;
  const bytes = await readFile(
    join(process.cwd(), "public/images/blog", filename),
  );
  const src = `data:image/png;base64,${bytes.toString("base64")}`;

  // Fit within a 900x440 box. For pixel art, snap to the largest integer scale
  // so it is never fractionally resampled; other art scales continuously.
  const maxW = 900;
  const maxH = 440;
  const fit = Math.min(maxW / meta.width, maxH / meta.height);
  const scale = meta.pixelated ? Math.max(1, Math.floor(fit)) : fit;
  return { src, width: Math.round(meta.width * scale), height: Math.round(meta.height * scale) };
}

export default async function PostOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.title ?? "Blog";
  const { regular, semibold, bold } = await loadFonts();
  const cover = post?.coverKey ? await loadCover(post.coverKey) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px",
          backgroundImage: `linear-gradient(135deg, ${BG_FROM}, ${BG_TO})`,
          fontFamily: "Figtree",
        }}
      >
        {/* Warm gold rule, the brand's one warm note. */}
        <div style={{ width: 72, height: 6, borderRadius: 3, backgroundColor: WARM }} />

        {/* Cover art centred on a dark mat, not stretched. */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {cover ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                borderRadius: 16,
                backgroundColor: MAT,
              }}
            >
              <img src={cover.src} width={cover.width} height={cover.height} alt="" />
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 60, fontWeight: 700, color: TEXT }}>
              {title}
            </div>
          )}
        </div>

        {/* Title + site wordmark on the bottom line. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {cover ? (
            <div
              style={{
                display: "flex",
                fontSize: 48,
                fontWeight: 700,
                color: TEXT,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {title}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              color: ACCENT,
              marginTop: 12,
            }}
          >
            {site.name}
          </div>
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
