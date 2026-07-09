import type { Metadata } from "next";

// Footer link and browser tab read "AI Policy" (parity with "Privacy" and
// "Subscribe"); the on-page heading is warmer. Like /privacy, this is a footer
// utility, so it is kept out of the top nav and the sitemap.
export const metadata: Metadata = { title: "AI Policy" };

export default function AIPolicyPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="text-h1 font-bold text-text">How I Use AI</h1>
      <p className="mt-2 text-caption text-text-muted">Last updated: July 8, 2026</p>

      <p className="mt-6 text-body text-text-muted">
        I use AI to help me write. I would rather say that plainly than pretend otherwise, so
        this page explains where it helps and where the line is. There is not much to it.
      </p>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">The short version</h2>
        <p className="mt-3 text-body text-text-muted">
          The ideas, the opinions, and the experiences on this site are mine. I use AI the way I
          would use a good editor: to help me structure a draft, tighten the wording, and catch
          mistakes. It does not decide what I think or write posts for me. If something is
          published here, I mean it and I stand behind it.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">What AI helps with</h2>
        <p className="mt-3 text-body text-text-muted">
          I treat AI as an editor and a sounding board, not an author.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-body text-text-muted">
          <li>Reworking a messy first draft into a clearer structure.</li>
          <li>Tightening sentences, fixing grammar, and catching typos.</li>
          <li>Talking through an idea to find the gaps in my own thinking.</li>
          <li>Suggesting a sharper word when the one I have is not quite right.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">What stays mine</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-body text-text-muted">
          <li>Every post starts from something I actually think and want to say.</li>
          <li>The arguments, the opinions, and the conclusions are my own.</li>
          <li>The experiences and stories are real and mine. AI does not invent them.</li>
          <li>I read every word before it ships and I stand behind all of it.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">Why I am telling you this</h2>
        <p className="mt-3 text-body text-text-muted">
          Honesty matters to me more than the appearance of writing everything unaided. A real
          person is doing the thinking here, and the polish is assisted. Both of those are true,
          and you deserve to know which is which.
        </p>
      </section>
    </section>
  );
}
