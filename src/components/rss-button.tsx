import { Button } from "@/components/ui";
import { RssIcon } from "@/components/blog-icons";

/**
 * The "subscribe via RSS" button (spec 0013), shared by the /blog header row and
 * the action row at the bottom of every post.
 *
 * It lives here because it was duplicated at those two call sites and had started
 * to drift: spec 0041 gave the /blog copy a narrow-viewport collapse and the post
 * copy kept the always-labelled treatment, so the same control behaved differently
 * on the same phone. One definition, one behaviour.
 *
 * Below 400px the wordmark is dropped and the button squares off to its icon
 * (matching Canopy's own `size="icon"` recipe - h-10 already comes from the default
 * `md` size), so a row carrying this plus a sibling button still fits on a 360/375px
 * phone. The `aria-label` is on the button itself rather than relying on the visible
 * text, so the accessible name survives the label being hidden. 400px, not `sm`
 * (640px), which would strip the label on viewports with room to spare.
 */
export function RssButton() {
  return (
    <Button
      asChild
      variant="outline"
      aria-label="Subscribe to the blog via RSS"
      className="max-[400px]:w-10 max-[400px]:gap-0 max-[400px]:px-0"
    >
      <a href="/blog/feed.xml">
        <RssIcon className="h-5 w-5" />
        <span className="max-[400px]:hidden">RSS</span>
      </a>
    </Button>
  );
}
