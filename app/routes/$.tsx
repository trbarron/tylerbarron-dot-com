import { useEffect } from 'react';
import { Link, data, redirect, useLocation } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { Navbar } from '~/components/Navbar';
import Footer from '~/components/Footer';
import { buildMeta } from '~/utils/seo';
import { trackNotFound } from '~/utils/analytics';
import { legacyRedirectPath } from './legacyRedirect';
import { buttonClass } from '~/components/Button';

// Render the 404 page with a 404 status. Matching the URL (instead of letting
// it fall through to the root ErrorBoundary) keeps the root loader running, so
// analytics and the full app shell work on not-found pages.
export function loader({ request }: LoaderFunctionArgs) {
  // Old static-site URLs (/CamelUpCup.html, /B0XX.html, …) still get inbound
  // traffic. Only .html paths are rewritten here — redirecting any other miss
  // could loop back onto this route.
  const url = new URL(request.url);
  if (/\.html$/i.test(url.pathname)) {
    const target = legacyRedirectPath(url.pathname, url.search);
    if (target) throw redirect(target, 301);
  }
  return data(null, { status: 404 });
}

export function meta() {
  return buildMeta({ title: '404', noIndex: true });
}

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    trackNotFound(location.pathname + location.search);
  }, [location]);

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-grow items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg border-4 border-black bg-white/95">
          {/* Big number */}
          <div className="border-b-4 border-black px-8 pt-8 pb-6">
            <p className="font-neo text-[10rem] leading-none font-black tracking-tighter text-black select-none">404</p>
          </div>

          {/* Message */}
          <div className="border-b-4 border-black px-8 py-6">
            <p className="font-neo mb-3 text-xl font-black tracking-tight text-black uppercase">Page Not Found</p>
            <p className="font-neo text-base leading-relaxed font-medium text-black">
              Whatever you were looking for isn&apos;t here. It may have moved, been deleted, or never existed in the
              wasteland.
            </p>
          </div>

          {/* Action */}
          <div className="px-8 py-6">
            <Link to="/" className={buttonClass({ variant: 'primary' })}>
              Back to Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
