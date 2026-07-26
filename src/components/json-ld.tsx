/**
 * One presentational component for every JSON-LD node on the site (spec 0040), so
 * the five schema types can never drift in their escaping. Renders a
 * `<script type="application/ld+json">` whose body is the object serialized with
 * `<` escaped as `<` - the exact defensive escaping that used to live inline
 * in `layout.tsx` - so a field that ever becomes dynamic can never break out of
 * the script element. Server-safe and hook-free (no state, no effects).
 */

type JsonLdProps = {
  /** A plain JSON-LD object (built by the pure `structured-data.ts` builders). */
  data: Record<string, unknown>;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // Build-time JSON from our own constants - no user input. Escape `<` so the
      // payload can never terminate the <script> element, even if a field later
      // becomes dynamic (matches the original inline layout.tsx treatment).
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
