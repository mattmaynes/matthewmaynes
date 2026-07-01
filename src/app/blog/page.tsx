import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAllPosts, formatPostDate } from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";

export const metadata: Metadata = { title: "Blog" };

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <h1 className="text-h1 font-bold text-text">Blog</h1>
      <p className="mt-3 max-w-2xl text-body text-text-muted">
        Notes on engineering, leadership, nature, and life - written down as I go.
      </p>

      {posts.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">No posts yet. Check back soon.</p>
        </div>
      ) : (
        <ul className="mt-10 flex flex-col gap-10">
          {posts.map((post) => {
            const cover = post.coverKey ? getBlogImage(post.coverKey) : undefined;
            const pixelated = cover?.pixelated === true;
            return (
              <li
                key={post.slug}
                className="grid gap-5 border-b border-border pb-10 last:border-b-0 sm:grid-cols-[200px_1fr]"
              >
                {cover ? (
                  <Link
                    href={`/blog/${post.slug}`}
                    className="block overflow-hidden rounded-lg border border-border bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
                  >
                    <Image
                      src={cover}
                      alt={cover.alt}
                      sizes="(max-width: 640px) 100vw, 200px"
                      placeholder={pixelated ? "empty" : "blur"}
                      className="aspect-[16/10] w-full object-contain p-3"
                      style={pixelated ? { imageRendering: "pixelated" } : undefined}
                    />
                  </Link>
                ) : null}
                <div>
                  <h2 className="text-h3 font-semibold">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="rounded-sm text-text hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-caption text-text-subtle">
                    <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                  </p>
                  <p className="mt-3 text-body text-text-muted">{post.excerpt}</p>
                  {post.tags.length > 0 ? (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded-full border border-border bg-muted px-3 py-1 text-caption text-text-muted"
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
