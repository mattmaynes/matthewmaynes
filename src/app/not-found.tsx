import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui";

// Browser tab and share cards read "Page Not Found" (parity with the other
// footer utility titles). Rendered inside the root layout, so the Header and
// Footer wrap it - this file only owns the centered message in <main>.
export const metadata: Metadata = { title: "Page Not Found" };

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
      <p className="text-caption font-medium uppercase tracking-wide text-text-muted">
        404
      </p>
      <h1 className="text-h1 font-bold text-text">
        Whoops, looks like you are lost!
      </h1>
      <p className="max-w-md text-body text-text-muted">
        The page you are looking for does not exist or may have moved. Let us get
        you back on solid ground.
      </p>
      <Button asChild variant="primary" size="lg">
        <Link href="/">Let&apos;s go home</Link>
      </Button>
    </section>
  );
}
