// Viewer-request: 301 www.tylerbarron.com to the bare domain, keeping path and query.
// Pages must be served from tylerbarron.com: their assets live there, and the
// CSP only allows 'self'.
// CloudFront requires a global handler rather than a module export.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handler(event) {
  var request = event.request;
  request.headers['x-site-viewer-ip'] = { value: event.viewer.ip };
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
