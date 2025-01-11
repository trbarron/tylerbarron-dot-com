import React, { useState, useEffect, useMemo } from 'react';

const PizzaLocationMap = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch JSON instead of SQLite database
        const response = await fetch('https://externalwebsiteassets.s3.us-west-2.amazonaws.com/dominos_locations.json');
        const locations = await response.json();
        setData(locations);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load location data');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const mapBounds = useMemo(() => {
    if (data.length === 0) return null;

    return {
      minLat: Math.min(...data.map(d => d.latitude)),
      maxLat: Math.max(...data.map(d => d.latitude)),
      minLng: Math.min(...data.map(d => d.longitude)),
      maxLng: Math.max(...data.map(d => d.longitude))
    };
  }, [data]);

  const coordToPixel = (lat, lng, width, height) => {
    if (!mapBounds) return { x: 0, y: 0 };

    const x = ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * width;
    const y = ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * height;
    return { x, y };
  };

  // Function to get color based on rating
  const getRatingColor = (rating) => {
    const hue = (rating / 5) * 120;
    return `hsl(${hue}, 70%, 50%)`;
  };

  if (loading) {
    return (
      <div className="w-full p-6">Loading location data...</div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6 text-red-500">{error}</div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg shadow">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Pizza Location Ratings</h2>
        <div className="text-sm text-gray-500 mb-4">
          {data.length} locations loaded
        </div>

        <div className="h-96 relative bg-gray-100 border rounded-lg">
          <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
            {data.map((location, i) => {
              const pos = coordToPixel(location.latitude, location.longitude, 800, 600);
              return (
                <circle
                  key={i}
                  cx={pos.x}
                  cy={pos.y}
                  r={4}
                  fill={getRatingColor(location.rating)}
                  opacity={0.8}
                >
                  <title>{`${location.name}\nRating: ${location.rating}\nReviews: ${location.total_ratings}`}</title>
                </circle>
              );
            })}
          </svg>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Statistics</h3>
          <div className="text-sm">
            <div>Total Locations: {data.length}</div>
            <div>Average Rating: {(data.reduce((sum, loc) => sum + loc.rating, 0) / data.length).toFixed(2)}</div>
            <div>Total Reviews: {data.reduce((sum, loc) => sum + loc.total_ratings, 0).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PizzaLocationMap;