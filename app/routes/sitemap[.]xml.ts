import { SITE_URL } from "~/utils/seo";

// Indexable static routes. Live-game and legacy-redirect URLs are
// intentionally excluded.
const STATIC_PATHS = [
  "/",
  "/blunder-watch",
  "/bouldering-tracker",
  "/camel-up-cup",
  "/camel-up-cup/2018",
  "/cat-tracker",
  "/cat-tracker/blog",
  "/chesser-guesser",
  "/collaborative-checkmate",
  "/generative-art",
  "/multiple-choice-chess",
  "/pizza-rating",
  "/set",
  "/SSBM",
  "/the-riddler",
];

function isoDate(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export async function loader() {
  const { getAllPostMeta } = await import("~/utils/posts.server");
  const posts = await getAllPostMeta();

  const entries = [
    ...STATIC_PATHS.map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`),
    ...posts.map((post) => {
      const lastmod = isoDate(post.date);
      return `  <url><loc>${SITE_URL}/blog/${post.slug}</loc>${
        lastmod ? `<lastmod>${lastmod}</lastmod>` : ""
      }</url>`;
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
