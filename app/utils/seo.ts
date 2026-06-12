import type { MetaDescriptor } from "react-router";

export const SITE_URL = "https://tylerbarron.com";
export const SITE_NAME = "Barron Wasteland";
export const DEFAULT_DESCRIPTION =
  "The personal site of Tyler Barron — chess games, generative art, engineering projects, and writing.";

interface SeoArgs {
  title?: string;
  description?: string;
  /** Canonical path (e.g. "/chesser-guesser"). Emits og:url + a canonical link. */
  path?: string;
  type?: "website" | "article";
  /** Set on ephemeral pages (live games, 404s) to keep them out of search indexes. */
  noIndex?: boolean;
}

/**
 * Standard meta for a route: title, description, Open Graph, and Twitter card.
 * React Router only uses the leaf route's meta, so every indexable route
 * should call this rather than relying on root defaults.
 */
export function buildMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  type = "website",
  noIndex = false,
}: SeoArgs = {}): MetaDescriptor[] {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  const meta: MetaDescriptor[] = [
    { title: fullTitle },
    { name: "description", content: description },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:site_name", content: SITE_NAME },
    { name: "twitter:card", content: "summary" },
  ];
  if (path) {
    const url = `${SITE_URL}${path}`;
    meta.push(
      { property: "og:url", content: url },
      { tagName: "link", rel: "canonical", href: url },
    );
  }
  if (noIndex) {
    meta.push({ name: "robots", content: "noindex" });
  }
  return meta;
}
