import { useEffect } from "react";

// Hosted Cusdis instance. The app ID is public (it ships in the page markup,
// like a GA measurement ID), so it lives here rather than in deploy config.
const CUSDIS_HOST = "https://cusdis.com";
const CUSDIS_APP_ID = "d79c1b03-ebf6-4d0f-b889-f3fc56bd9d24";
const CUSDIS_SCRIPT = `${CUSDIS_HOST}/js/cusdis.es.js`;

interface CusdisProps {
  /** Stable per-thread identifier — the post slug. */
  pageId: string;
  /** Absolute canonical URL of the post. */
  pageUrl: string;
  pageTitle: string;
}

/**
 * Cusdis comment thread. Login-free, privacy-friendly hosted comments.
 * The loader script auto-renders #cusdis_thread on first load; on client-side
 * navigation between posts we call CUSDIS.initial() to re-render the thread.
 */
export default function Cusdis({ pageId, pageUrl, pageTitle }: CusdisProps) {
  useEffect(() => {
    if (window.CUSDIS) {
      window.CUSDIS.initial();
      return;
    }
    // Inject the loader once; guard against React's double-effect in dev.
    if (document.querySelector("script[data-cusdis]")) return;
    const script = document.createElement("script");
    script.src = CUSDIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-cusdis", "");
    document.body.appendChild(script);
  }, [pageId]);

  return (
    <div
      id="cusdis_thread"
      data-host={CUSDIS_HOST}
      data-app-id={CUSDIS_APP_ID}
      data-page-id={pageId}
      data-page-url={pageUrl}
      data-page-title={pageTitle}
      data-theme="light"
    />
  );
}
