import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { site } from "@/lib/site";
import { getPublishedPosts, getPostBySlug, readingMinutes } from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";

// Needs the Node runtime to read the cover + font files off disk.
export const runtime = "nodejs";

export const alt = "Blog post on matthewmaynes.com";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Bake one card per post at build so this route is static, rather than reading
// content/ per request and relying on Next file-tracing to have copied it.
export function generateStaticParams() {
  return getPublishedPosts().map((post) => ({ slug: post.slug }));
}

// Harbor-dark palette (see brand/harbor/ + src/styles/brand-harbor.generated.css), matching the site card.
const BG_FROM = "#1f3447"; // harbor-900
const BG_TO = "#14222f"; // slate-950
const TEXT = "#f6f7f9"; // slate-50
const ACCENT = "#82a6c8"; // harbor-300
const WARM = "#cf9343"; // accent (gold)
const WARM_FG = "#14222f"; // dark text on the gold tag pills

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
// URL. The cover fills the whole card (object-fit: cover), so no fit math is
// needed; `pixelated` is carried through so pixel-art covers render crisply
// instead of being smoothly upscaled.
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
  return { src, pixelated: meta.pixelated === true };
}

export default async function PostOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.title ?? "Blog";
  const tags = post?.tags ?? [];
  const minutes = post ? readingMinutes(post) : null;
  const { regular, semibold, bold } = await loadFonts();
  const cover = post?.coverKey ? await loadCover(post.coverKey) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          fontFamily: "Figtree",
          // Brand gradient base: shows through when a post has no cover.
          backgroundImage: `linear-gradient(135deg, ${BG_FROM}, ${BG_TO})`,
        }}
      >
        {/* Full-bleed cover art, cropped to fill the whole card. */}
        {cover ? (
          <img
            src={cover.src}
            width={size.width}
            height={size.height}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: size.width,
              height: size.height,
              objectFit: "cover",
              ...(cover.pixelated ? { imageRendering: "pixelated" as const } : {}),
            }}
          />
        ) : null}

        {/* Bottom scrim so the overlaid text stays legible over any image. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            display: "flex",
            backgroundImage:
              "linear-gradient(to top, rgba(8,12,16,0.94) 0%, rgba(8,12,16,0.62) 38%, rgba(8,12,16,0) 68%)",
          }}
        />

        {/* Overlaid content, anchored to the bottom. */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            justifyContent: "flex-end",
            padding: "72px",
          }}
        >
          {/* Warm gold rule, the brand's one warm note. */}
          <div style={{ width: 72, height: 6, borderRadius: 3, backgroundColor: WARM }} />

          {/* Tag + read-time badges. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
            {tags.map((tag) => (
              <div
                key={tag}
                style={{
                  display: "flex",
                  fontSize: 24,
                  fontWeight: 600,
                  color: WARM_FG,
                  backgroundColor: WARM,
                  borderRadius: 999,
                  padding: "6px 20px",
                }}
              >
                {tag}
              </div>
            ))}
            {minutes != null ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  fontWeight: 600,
                  color: TEXT,
                  backgroundColor: "rgba(246,247,249,0.16)",
                  borderRadius: 999,
                  padding: "6px 20px",
                }}
              >
                {`${minutes} min read`}
              </div>
            ) : null}
          </div>

          {/* Title. */}
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 700,
              color: TEXT,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              marginTop: 22,
            }}
          >
            {title}
          </div>

          {/* Site wordmark. */}
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              color: ACCENT,
              marginTop: 16,
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
