import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData
} from "react-router";
import styles from './styles/index.css';

export async function loader() {
  return {
    gaTrackingId: process.env.GA_TRACKING_ID || null,
  };
}

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon" }
];

export const meta = () => {
  return [
    { title: "Barron Wasteland" }
  ];
};

export default function App() {
  const { gaTrackingId } = useLoaderData<typeof loader>();

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
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}