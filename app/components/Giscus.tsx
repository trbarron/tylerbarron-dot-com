import { useEffect, useRef } from "react";

// giscus config. The repo + node IDs are public (they ship in the page markup).
// repo-id and category-id come from https://giscus.app after enabling GitHub
// Discussions on the repo and installing the giscus app (https://github.com/apps/giscus).
const GISCUS_REPO = "trbarron/tylerbarron-dot-com";
const GISCUS_REPO_ID = "R_kgDOMxfZIw";
const GISCUS_CATEGORY = "Announcements";
const GISCUS_CATEGORY_ID = "DIC_kwDOMxfZI84C_D2w";
const GISCUS_SCRIPT = "https://giscus.app/client.js";

interface GiscusProps {
  /** Stable term mapping a post to its discussion thread — the post slug. */
  term: string;
}

/**
 * giscus comment thread (GitHub Discussions-backed). The widget renders in a
 * cross-origin iframe; giscus doesn't auto-update on SPA navigation, so we
 * re-create the loader script whenever the post (term) changes.
 */
export default function Giscus({ term }: GiscusProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !GISCUS_CATEGORY_ID) return;

    container.innerHTML = "";
    const script = document.createElement("script");
    script.src = GISCUS_SCRIPT;
    script.async = true;
    script.crossOrigin = "anonymous";
    const attrs: Record<string, string> = {
      "data-repo": GISCUS_REPO,
      "data-repo-id": GISCUS_REPO_ID,
      "data-category": GISCUS_CATEGORY,
      "data-category-id": GISCUS_CATEGORY_ID,
      "data-mapping": "specific",
      "data-term": term,
      "data-strict": "1",
      "data-reactions-enabled": "1",
      "data-emit-metadata": "0",
      "data-input-position": "top",
      "data-theme": "light",
      "data-lang": "en",
      "data-loading": "lazy",
    };
    for (const [key, value] of Object.entries(attrs)) script.setAttribute(key, value);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [term]);

  return <div ref={containerRef} className="giscus" />;
}
