import { useEffect } from "react";
import { Link, data, useLocation } from "react-router";
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import { buildMeta } from "~/utils/seo";
import { trackNotFound } from "~/utils/analytics";

// Render the 404 page with a 404 status. Matching the URL (instead of letting
// it fall through to the root ErrorBoundary) keeps the root loader running, so
// analytics and the full app shell work on not-found pages.
export function loader() {
  return data(null, { status: 404 });
}

export function meta() {
  return buildMeta({ title: "404", noIndex: true });
}

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    trackNotFound(location.pathname + location.search);
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <Navbar />
      <main className="flex-grow flex items-center justify-center px-4 py-16">
        <div className="border-4 border-black bg-white/95 w-full max-w-lg">
          {/* Big number */}
          <div className="border-b-4 border-black px-8 pt-8 pb-6">
            <p className="font-neo font-black text-[10rem] leading-none tracking-tighter text-black select-none">
              404
            </p>
          </div>

          {/* Message */}
          <div className="border-b-4 border-black px-8 py-6">
            <p className="font-neo font-black text-xl uppercase tracking-tight text-black mb-3">
              Page Not Found
            </p>
            <p className="font-neo font-medium text-base text-black leading-relaxed">
              Whatever you were looking for isn&apos;t here. It may have moved,
              been deleted, or never existed in the wasteland.
            </p>
          </div>

          {/* Action */}
          <div className="px-8 py-6">
            <Link
              to="/"
              className="inline-block border-4 border-black bg-black text-white font-neo font-black uppercase tracking-wide px-6 py-3 hover:bg-white hover:text-black transition-all duration-100"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
