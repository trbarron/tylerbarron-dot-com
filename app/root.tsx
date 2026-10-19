import type { LinksFunction } from 'react-router';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useRouteError,
  useRouteLoaderData,
  isRouteErrorResponse,
  Link,
} from 'react-router';
import { useEffect } from 'react';
import styles from './styles/index.css?url';
import { buildMeta } from './utils/seo';
import { trackNotFound } from './utils/analytics';
import faviconUrl from './favicon.png';
import DichroicBackground from './components/DichroicBackground';
import { RetroreflectanceProvider } from './components/retroreflectance-context';
import { buttonClass } from '~/components/Button';

export async function loader() {
  const rawId = process.env.GA_TRACKING_ID?.trim() || null;
  // Validate GA tracking ID format to prevent XSS via dangerouslySetInnerHTML
  const gaTrackingId = rawId && /^(G|GT)-[A-Za-z0-9]+$/.test(rawId) ? rawId : null;
  return { gaTrackingId };
}

// EEA + UK + CH: analytics cookies denied by default in these regions (Consent
// Mode v2); GA falls back to cookieless pings there. Granted everywhere else.
const CONSENT_DENIED_REGIONS = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB',
  'CH',
];

function GtagScripts({ gaTrackingId, sendPageView }: { gaTrackingId: string; sendPageView: boolean }) {
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaTrackingId}`} />
      <script
        id="gtag-init"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            window.gtag = function(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              analytics_storage: 'granted'
            });
            gtag('consent', 'default', {
              analytics_storage: 'denied',
              region: ${JSON.stringify(CONSENT_DENIED_REGIONS)}
            });
            gtag('js', new Date());
            gtag('config', '${gaTrackingId}', {
              send_page_view: ${sendPageView}
            });
          `,
        }}
      />
    </>
  );
}

export const links: LinksFunction = () => [
  { rel: 'icon', type: 'image/png', href: faviconUrl },
  { rel: 'apple-touch-icon', href: faviconUrl },
  { rel: 'stylesheet', href: styles },
  // RSS feed autodiscovery (consumed by feed readers).
  { rel: 'alternate', type: 'application/rss+xml', title: 'Barron Wasteland', href: '/feed.xml' },
];

export const meta = () => {
  return buildMeta();
};

export function ErrorBoundary() {
  const error = useRouteError();
  // Root loader data is available when a child route threw (e.g. 404), but not
  // when the root loader itself failed — degrade to no analytics in that case.
  const rootData = useRouteLoaderData<typeof loader>('root');
  const gaTrackingId = rootData?.gaTrackingId ?? null;
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const isServerError = isRouteErrorResponse(error) && error.status >= 500;
  const status = isRouteErrorResponse(error) ? error.status : 500;

  useEffect(() => {
    if (!gaTrackingId || !is404) return;
    trackNotFound(window.location.pathname + window.location.search);
  }, [gaTrackingId, is404]);

  const title = is404 ? '404' : String(status);
  const heading = is404 ? 'Page Not Found' : 'Something Went Wrong';
  const message = is404
    ? "Whatever you were looking for isn't here."
    : isServerError
      ? 'A server error occurred. Try again in a moment.'
      : 'An unexpected error occurred.';

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* The site is light-only. Forced dark modes recolour it badly — Brave
            iOS Night Mode (Dark Reader) inverts the black chess-piece SVGs into
            white ones. darkreader-lock opts out of Dark Reader; "only light"
            opts out of Chromium's auto dark mode. */}
        <meta name="darkreader-lock" />
        <meta name="color-scheme" content="only light" />
        <title>{`${title} — Barron Wasteland`}</title>
        <Links />
        {/* Error pages have no client navigations, so let gtag auto-send the page view */}
        {gaTrackingId && <GtagScripts gaTrackingId={gaTrackingId} sendPageView={true} />}
      </head>
      <body>
        <nav className="flex flex-wrap items-center justify-between border-b-4 border-black bg-white px-4 py-6">
          <Link
            to="/"
            className="font-neo px-2 py-1 text-2xl font-extrabold tracking-tighter text-black uppercase transition-all duration-100 hover:bg-black hover:text-white"
          >
            Barron Wasteland
          </Link>
        </nav>

        <main className="flex min-h-[80vh] items-center justify-center bg-white px-4 py-16">
          <div className="w-full max-w-lg border-4 border-black bg-white">
            <div className="border-b-4 border-black px-8 pt-8 pb-6">
              <p className="font-neo text-[10rem] leading-none font-black tracking-tighter text-black select-none">
                {title}
              </p>
            </div>
            <div className="border-b-4 border-black px-8 py-6">
              <p className="font-neo mb-3 text-xl font-black tracking-tight text-black uppercase">{heading}</p>
              <p className="font-neo text-base leading-relaxed font-medium text-black">{message}</p>
            </div>
            <div className="px-8 py-6">
              <Link to="/" className={buttonClass({ variant: 'primary' })}>
                Back to Home
              </Link>
            </div>
          </div>
        </main>

        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { gaTrackingId } = useLoaderData<typeof loader>();
  const location = useLocation();

  useEffect(() => {
    if (!gaTrackingId) return;
    const { gtag } = window;
    if (typeof gtag !== 'function') return;
    // GA4 SPA page view — fires on initial mount and whenever the URL changes.
    // Keyed on path + query rather than the location object: same-URL
    // navigations (e.g. Chesser Guesser's navigate(".") to revalidate for the
    // next position) get a new location key and would log a duplicate view.
    gtag('event', 'page_view', {
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location.pathname, location.search, gaTrackingId]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* The site is light-only. Forced dark modes recolour it badly — Brave
            iOS Night Mode (Dark Reader) inverts the black chess-piece SVGs into
            white ones. darkreader-lock opts out of Dark Reader; "only light"
            opts out of Chromium's auto dark mode. */}
        <meta name="darkreader-lock" />
        <meta name="color-scheme" content="only light" />
        <Meta />
        <Links />

        {/* send_page_view: false — page views are sent manually on location change */}
        {gaTrackingId && <GtagScripts gaTrackingId={gaTrackingId} sendPageView={false} />}
      </head>
      <body>
        <RetroreflectanceProvider>
          {/* WebGL retroreflective-fabric background effect. Opt-in from the
              footer control, so it renders pure white until asked. */}
          <DichroicBackground />

          <Outlet />
        </RetroreflectanceProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
