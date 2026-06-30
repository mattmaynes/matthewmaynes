// X/Twitter reuses the same branded card as Open Graph. Re-export the OG route
// so there is one card definition, not two that can drift apart.
export { default, alt, size, contentType } from "./opengraph-image";

export const runtime = "nodejs";
