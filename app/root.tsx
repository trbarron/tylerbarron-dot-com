import type { LinksFunction } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useRouteError,
  isRouteErrorResponse,
  Link,
} from "react-router";
import { useEffect } from "react";
import styles from './styles/index.css?url';
import DichroicBackground from './components/DichroicBackground';

export async function loader() {
  const rawId = process.env.GA_TRACKING_ID?.trim() || null;
  // Validate GA tracking ID format to prevent XSS via dangerouslySetInnerHTML
  const gaTrackingId = rawId && /^(G|UA|GT)-[A-Za-z0-9-]+$/.test(rawId) ? rawId : null;
  return { gaTrackingId };
}

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles }
];

export const meta = () => {
  return [
    { title: "Barron Wasteland" }
  ];
};

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const isServerError = isRouteErrorResponse(error) && error.status >= 500;
  const status = isRouteErrorResponse(error) ? error.status : 500;

  const title = is404 ? "404" : String(status);
  const heading = is404 ? "Page Not Found" : "Something Went Wrong";
  const message = is404
    ? "Whatever you were looking for isn't here." : isServerError ? "A server error occurred. Try again in a moment." : "An unexpected error occurred.";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} — Barron Wasteland</title>
        <Links />
      </head>
      <body>
        <nav className="border-b-4 border-black flex flex-wrap items-center justify-between px-4 py-6 bg-white">
          <Link
            to="/"
            className="font-neo font-extrabold text-2xl tracking-tighter text-black uppercase hover:bg-black hover:text-white px-2 py-1 transition-all duration-100"
          >
            Barron Wasteland
          </Link>
        </nav>

        <main className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-white">
          <div className="border-4 border-black bg-white w-full max-w-lg">
            <div className="border-b-4 border-black px-8 pt-8 pb-6">
              <p className="font-neo font-black text-[10rem] leading-none tracking-tighter text-black select-none">
                {title}
              </p>
            </div>
            <div className="border-b-4 border-black px-8 py-6">
              <p className="font-neo font-black text-xl uppercase tracking-tight text-black mb-3">
                {heading}
              </p>
              <p className="font-neo font-medium text-base text-black leading-relaxed">
                {message}
              </p>
            </div>
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

        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { gaTrackingId } = useLoaderData<typeof loader>();
  const location = useLocation();

  useEffect(() => {
    if (gaTrackingId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gtag = (window as any).gtag;
      if (typeof gtag === "function") {
        gtag("config", gaTrackingId, {
          page_path: location.pathname + location.search,
        });
      }
    }
  }, [location, gaTrackingId]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />

        {gaTrackingId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaTrackingId}`} />
            <script
              id="gtag-init"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  window.gtag = function(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaTrackingId}', {
                    send_page_view: false
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body>
        {/* WebGL Dichroic glass background effect */}
        <DichroicBackground />

        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}