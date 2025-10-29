// Return 204 No Content for favicon requests to stop browsers from repeatedly requesting it
export const loader = async () => {
  return new Response(null, { 
    status: 204,
    headers: {
      "Cache-Control": "public, max-age=86400", // Cache for 24 hours
    }
  });
};

