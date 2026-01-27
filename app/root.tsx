import type { LinksFunction } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from "react-router";
import { useEffect } from "react";
import styles from './styles/index.css?url';

export async function loader() {
  return {
    gaTrackingId: process.env.GA_TRACKING_ID || null,
  };
}

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles }
];

export const meta = () => {
  return [
    { title: "Barron Wasteland" }
  ];
};

export default function App() {
  const { gaTrackingId } = useLoaderData<typeof loader>();
  const location = useLocation();

  useEffect(() => {
    if (gaTrackingId?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gtag?.("config", gaTrackingId, {
        page_path: location.pathname + location.search,
      });
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
              async
              id="gtag-init"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaTrackingId}');
                `,
              }}
            />
          </>
        )}
      </head>
      <body>
        {/* Dichroic glass background effect */}
        <div className="dichroic-bg" aria-hidden="true" />
        <div className="dichroic-shimmer" aria-hidden="true" />
        <div className="dichroic-white" aria-hidden="true" />

        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}