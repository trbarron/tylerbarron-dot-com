// Viewer-request on the default behavior. /assets/*, /fonts/* and /images/*
// have their own behaviors and never run it.
//
// 1. Stamps the viewer's address for rate limits.
// 2. Answers scanner probes for software this site doesn't run (PHP,
//    WordPress, Java and .NET servers, ColdFusion, CGI, dotfiles) with a 404
//    here, so each one doesn't start the Lambda to render a 404 page. Every
//    real route is extensionless or a named file (robots.txt, sitemap.xml,
//    feed.xml, favicon.ico, giscus-theme.css), and any other miss still gets
//    the site's own 404 page.
// 3. 301s www.tylerbarron.com to the bare domain, keeping path and query.
//    Pages must be served from tylerbarron.com: their assets live there, and
//    the CSP only allows 'self'.
//
// Published by hand, not by CI: docs/deployment.md, "The viewer-request function".
// CloudFront requires a global handler rather than a module export.

var PROBE = new RegExp(
  [
    // A file type, at the end of a path segment (".php/", ".jsp;" and "x.php" alike).
    '\\.(php\\d?|phtml|aspx?|ashx|asmx|axd|jspx?|cgi|cfml?|cfc|action|dll|env|ini|sql|bak)(/|;|$)',
    // A whole segment that names software or a directory this site doesn't have.
    '(^|/)(wp-[^/]*|wordpress|cgi-bin|scgi-bin|cfide|phpmyadmin|_ignition|_next|vendor)(/|$)',
    // A dotfile or dot-directory (/.env, /.git/config, "..;"), except /.well-known/.
    '(^|/)\\.(?!well-known(/|$))',
  ].join('|'),
  'i',
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handler(event) {
  var request = event.request;
  request.headers['x-site-viewer-ip'] = { value: event.viewer.ip };

  if (PROBE.test(request.uri)) {
    return {
      statusCode: 404,
      statusDescription: 'Not Found',
      headers: { 'content-type': { value: 'text/plain; charset=utf-8' } },
      body: { encoding: 'text', data: 'Not Found' },
    };
  }

  var host = request.headers.host && request.headers.host.value;
  if (host !== 'www.tylerbarron.com') return request;

  var query = Object.keys(request.querystring)
    .map(function (key) {
      var param = request.querystring[key];
      var values = param.multiValue ? param.multiValue : [param];
      return values
        .map(function (v) {
          return v.value === '' ? key : key + '=' + v.value;
        })
        .join('&');
    })
    .join('&');

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: 'https://tylerbarron.com' + request.uri + (query ? '?' + query : '') },
      'cache-control': { value: 'max-age=3600' },
    },
  };
}
