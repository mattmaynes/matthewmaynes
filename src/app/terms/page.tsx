import type { Metadata } from "next";
import Link from "next/link";

// The readable half of the licensing position (spec 0042). The machine- and
// developer-facing half is the repo's root LICENSE, and the footer is the
// pointer to here. All three must agree: change one, review all three.
// A footer utility like /privacy and /ai-policy, so it stays out of the top nav
// (it IS in the sitemap - people and crawlers should both be able to find it).
export const metadata: Metadata = {
  title: "Terms",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="text-h1 font-bold text-text">Terms and Copyright</h1>
      <p className="mt-2 text-caption text-text-muted">Last updated: August 4, 2026</p>

      <p className="mt-6 text-body text-text-muted">
        This is my personal site. I write everything on it. The photographs and video are
        mine or my family&apos;s, and some of the cover art is illustration I made or
        generated for a post. This page explains what you may do with all of that, what you
        may not, and how to ask if you want to do something else.
      </p>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">The short version</h2>
        <p className="mt-3 text-body text-text-muted">
          I own what is here and I have not put it up for reuse. You are welcome to read it,
          link to it, and quote a bit of the writing with credit. Please do not republish it,
          and please do not use the photos or video of my family for anything at all. The code
          that runs the site is a different matter and is open source.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">What you may do</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-body text-text-muted">
          <li>Read anything here, and link to any page.</li>
          <li>
            Quote a short excerpt of the <strong className="font-semibold text-text">writing</strong>{" "}
            with clear attribution and a link back to the original page. Ordinary quotation, the
            kind a review or a citation makes, not republication in whole or in substantial part.
          </li>
          <li>Share a link with anyone you like. That is the whole point of publishing.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">What you may not do</h2>
        <p className="mt-3 text-body text-text-muted">
          Everything here is copyright me, all rights reserved. Without my written permission,
          please do not:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-body text-text-muted">
          <li>Republish, mirror, or redistribute a post, in whole or in substantial part.</li>
          <li>
            Reproduce the{" "}
            <strong className="font-semibold text-text">
              photographs, video, or illustrations
            </strong>{" "}
            anywhere, in any medium. These include pictures of my wife and daughter, and they are
            not stock imagery. This one matters most to me.
          </li>
          <li>Sell it, or use it in something you sell.</li>
          <li>Present it as your own, or as anyone else&apos;s.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">AI and automated use</h2>
        <p className="mt-3 text-body text-text-muted">
          I am glad for answer engines to read this site and point people at it. That is useful
          to me and to the person asking. So the same line applies to machines as to people:
          the <strong className="font-semibold text-text">text</strong> may be read, quoted, and
          cited with attribution and a link.
        </p>
        <p className="mt-3 text-body text-text-muted">
          The <strong className="font-semibold text-text">images and video</strong> may not be
          reproduced, redistributed, or used as training data, in whole or in part. If you are
          building a dataset, exclude them. &quot;Quoted&quot; above means a short excerpt with a
          link, not the full text of a post.
        </p>
        <p className="mt-3 text-body text-text-muted">
          Separately, if you are curious how I use AI when writing, that is on the{" "}
          <Link
            href="/ai-policy"
            className="text-primary underline underline-offset-4 hover:text-primary-hover"
          >
            AI policy
          </Link>{" "}
          page.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">The code is open source</h2>
        <p className="mt-3 text-body text-text-muted">
          The site itself is built in the open and the source is MIT licensed. Take it, learn
          from it, build your own. That permission covers the code only, not the writing or the
          media - including the prose that lives inside the code, like the copy on these pages
          and my resume. The{" "}
          <a
            href="https://github.com/mattmaynes/matthewmaynes/blob/main/LICENSE"
            className="text-primary underline underline-offset-4 hover:text-primary-hover"
          >
            licence file
          </a>{" "}
          spells out exactly which is which.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">These views are my own</h2>
        <p className="mt-3 text-body text-text-muted">
          Everything on this site is personal. The opinions, conclusions, and occasional bad
          jokes are mine alone. They are not the views of my employer, past or present, and
          nothing here should be read as representing, or speaking on behalf of, any company I
          have worked for or currently work for.
        </p>
        <p className="mt-3 text-body text-text-muted">
          I write about my work because it is where I have learned the most. When I do, I am
          describing my own experience and what I took from it, not company positions, plans, or
          confidential information.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-text">Want to use something?</h2>
        <p className="mt-3 text-body text-text-muted">
          Ask. I am reasonable, and for most things the answer is probably yes, especially if you
          are crediting the work. Send me a note through the{" "}
          <Link
            href="/contact"
            className="text-primary underline underline-offset-4 hover:text-primary-hover"
          >
            contact page
          </Link>{" "}
          and tell me what you have in mind.
        </p>
      </section>
    </section>
  );
}
