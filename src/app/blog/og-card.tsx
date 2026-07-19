import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { site } from "@/lib/site";
import { readingMinutes, type Post } from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";

/**
 * Shared per-post Open Graph / Twitter card renderer, used by BOTH the published
 * post route (`app/blog/[slug]/opengraph-image.tsx`) and the draft route
 * (`app/blog/drafts/[slug]/opengraph-image.tsx`), so a draft previews with the
 * SAME real card it will ship with instead of the generic site image, and the
 * two cannot drift. Not a route file itself (`og-card` is not a reserved name),
 * just a module both routes import.
 */

export const alt = "Blog post on matthewmaynes.com";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Harbor-dark palette (see brand/harbor/), matching the site card.
const BG_FROM = "#1f3447"; // harbor-900
const BG_TO = "#14222f"; // slate-950
const TEXT = "#f6f7f9"; // slate-50
const ACCENT = "#82a6c8"; // harbor-300
const WARM = "#cf9343"; // accent (gold)
const WARM_FG = "#14222f"; // dark text on the gold tag pills

// Fonts: Figtree woff colocated in src/app/_og/, loaded via new URL(...,
// import.meta.url) so they are traced into the standalone build (learnings 0004).
// This module lives at src/app/blog/, so _og is one level up.
async function loadFonts() {
  const [regular, semibold, bold] = await Promise.all([
    readFile(new URL("../_og/figtree-400.woff", import.meta.url)),
    readFile(new URL("../_og/figtree-600.woff", import.meta.url)),
    readFile(new URL("../_og/figtree-700.woff", import.meta.url)),
  ]);
  return { regular, semibold, bold };
}

// Resolve a cover key to its actual filename: a key WITH an extension is used
// as-is (so a .jpg photo works), a bare legacy key implies .png. The data-URL
// MIME follows the extension so satori decodes JPEG covers correctly (a wrong
// MIME, as the old .png-only loader produced, fails to render).
function coverFilename(coverKey: string): string {
  return /\.(png|jpe?g|webp|avif|gif)$/i.test(coverKey)
    ? coverKey
    : `${coverKey}.png`;
}

function coverMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "avif") return "image/avif";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

// Read the cover from public/ (the standalone copy step deploys public/ next to
// server.js), returning a data URL plus its render flags. The cover fills the
// whole card (object-fit: cover); `focus: "top"` anchors the crop to the top so
// a tall portrait's subject is not cropped out; `pixelated` keeps pixel-art crisp.
//
// satori's image parser is reliable on PNG but chokes on some JPEGs
// ("Offset is outside the bounds of the DataView"), so a non-PNG cover ships a
// committed PNG rendition at images/blog/og/<basename>.png (already framed to the
// card). We prefer that rendition, then fall back to the cover file itself (PNG
// covers need none). This keeps the site cover a right-format JPEG photo while the
// card still renders.
async function loadCover(coverKey: string) {
  const meta = getBlogImage(coverKey);
  if (!meta) return null;
  const filename = coverFilename(coverKey);
  const base = filename.replace(/\.[^.]+$/, "");
  const candidates = filename.toLowerCase().endsWith(".png")
    ? [filename]
    : [`og/${base}.png`, filename];
  for (const rel of candidates) {
    try {
      const bytes = await readFile(join(process.cwd(), "public/images/blog", rel));
      return {
        src: `data:${coverMime(rel)};base64,${bytes.toString("base64")}`,
        pixelated: meta.pixelated === true,
        objectPosition: meta.focus === "top" ? "top" : "center",
      };
    } catch {
      // Try the next candidate (a missing PNG rendition falls through to the cover).
    }
  }
  return null;
}

/** Build the per-post OG ImageResponse. `post` may be null (unknown slug), which
 *  renders the branded gradient base with a "Blog" title, never throwing. */
export async function renderPostOgCard(post: Post | null): Promise<ImageResponse> {
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
          backgroundImage: `linear-gradient(135deg, ${BG_FROM}, ${BG_TO})`,
        }}
      >
        {cover ? (
          // This card is rasterized by satori (next/og), not served to a browser,
          // so next/image does not apply. The reserved opengraph-image route file
          // is exempt from this rule, but this shared module is not.
          // eslint-disable-next-line @next/next/no-img-element
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
              objectPosition: cover.objectPosition,
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
          <div style={{ width: 72, height: 6, borderRadius: 3, backgroundColor: WARM }} />

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
