// Chrome DevTools probes this URL whenever DevTools is open against localhost
// (workspace project-settings discovery). Reply with an empty config so React
// Router doesn't throw "No route matches" and pollute the dev console.
export const loader = async () => {
  return new Response("{}", {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
