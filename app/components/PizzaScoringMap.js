import React, { useState, useEffect } from 'react';
import { geoAlbersUsa } from 'd3-geo';

const PizzaLocationMap = () => {
  const [reviewData, setReviewData] = useState([]);
  const [scoreData, setScoreData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredLocation, setHoveredLocation] = useState(null);
  const [hoveredScore, setHoveredScore] = useState(null);
  const [showReviews, setShowReviews] = useState(true);
  const [showPizzaScore, setShowPizzaScore] = useState(true);
  
  // Set up projection
  const width = 1200;
  const height = 800;
  const projection = geoAlbersUsa().fitSize([width, height], {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiPolygon",
      coordinates: [[[[100, 40], [120, 40], [120, 50], [100, 50]]]]
    }
  });

  // Fetch review data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          'https://externalwebsiteassets.s3.us-west-2.amazonaws.com/dominos_locations.json'
        );
        const locations = await response.json();
        setReviewData(locations);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load location data');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Fetch pizza score data
  useEffect(() => {
    const loadScoreData = async () => {
      try {
        const response = await fetch(
          'https://externalwebsiteassets.s3.us-west-2.amazonaws.com/pizza_network.json'
        );
        const scores = await response.json();
        setScoreData(scores);
      } catch (error) {
        console.error('Error loading score data:', error);
      }
    };

    loadScoreData();
  }, []);

  // Calculate color based on rating
  const getRatingColor = (rating) => {
    const hue = (rating / 5) * 120;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Render pizza score heatmap
  const renderPizzaScoreHeatmap = () => {
    if (!showPizzaScore || !scoreData.length) return null;

    return scoreData.map((point, i) => {
      const [x, y] = projection([point.longitude, point.latitude]) || [0, 0];
      if (!x || !y) return null;

      return (
        <circle
          key={`score-${i}`}
          cx={x}
          cy={y}
          r={6}
          fill={getRatingColor(point.pizza_score)}
          opacity={0.3}
          onMouseEnter={() => setHoveredScore(point)}
          onMouseLeave={() => setHoveredScore(null)}
          style={{ cursor: 'pointer' }}
        />
      );
    });
  };

  // Render review points
  const renderReviewPoints = () => {
    if (!showReviews || !reviewData.length) return null;

    return reviewData.map((location, i) => {
      const [x, y] = projection([location.longitude, location.latitude]) || [0, 0];
      if (!x || !y) return null;
      
      return (
        <circle
          key={`review-${i}`}
          cx={x}
          cy={y}
          r={4}
          fill={getRatingColor(location.rating)}
          opacity={0.8}
          onMouseEnter={() => setHoveredLocation(location)}
          onMouseLeave={() => setHoveredLocation(null)}
          style={{ cursor: 'pointer' }}
        />
      );
    });
  };

  // Render hover information
  const renderHoverInfo = () => {
    if (hoveredLocation && showReviews) {
      const [x, y] = projection([hoveredLocation.longitude, hoveredLocation.latitude]) || [0, 0];
      if (!x || !y) return null;

      return (
        <g>
          <rect
            x={x + 20}
            y={y - 35}
            width="200"
            height="80"
            fill="white"
            stroke="black"
            strokeWidth="0.5"
          />
          <text x={x + 20} y={y - 15} fontSize="24" fontWeight="bold">
            {hoveredLocation.name}
          </text>
          <text x={x + 20} y={y + 7} fontSize="24">
            Rating: {hoveredLocation.rating}
          </text>
          <text x={x + 20} y={y + 29} fontSize="24">
            Reviews: {hoveredLocation.total_ratings}
          </text>
        </g>
      );
    }

    if (hoveredScore && showPizzaScore && !showReviews) {
      const [x, y] = projection([hoveredScore.longitude, hoveredScore.latitude]) || [0, 0];
      if (!x || !y) return null;

      return (
        <g>
          <rect
            x={x + 10}
            y={y - 15}
            width="180"
            height="60"
            fill="white"
            stroke="black"
            strokeWidth="0.5"
          />
          <text x={x + 15} y={y + 4} fontSize="24" fontWeight="bold">
            Pizza Score
          </text>
          <text x={x + 15} y={y + 32} fontSize="24">
            Score: {hoveredScore.pizza_score.toFixed(2)}
          </text>
        </g>
      );
    }
  };

  if (loading) {
    return <div className="w-full p-6">Loading location data...</div>;
  }

  if (error) {
    return <div className="w-full p-6 text-red-500">{error}</div>;
  }

  return (
    <div className="w-full h-full bg-white rounded-lg shadow">
      <div className="p-4">       
        <div className="flex items-center gap-8 mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showReviews}
              onChange={(e) => setShowReviews(e.target.checked)}
              className="form-checkbox"
            />
            Show Raw Pizza Reviews
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showPizzaScore}
              onChange={(e) => setShowPizzaScore(e.target.checked)}
              className="form-checkbox"
            />
            Show Calculated Pizza Scores
          </label>
        </div>

        <div className="h-2/4 max-h-[800px] relative bg-gray-100 border rounded-lg">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <rect width={width} height={height} fill="#f8f9fa" />
            {renderPizzaScoreHeatmap()}
            {renderReviewPoints()}
            {renderHoverInfo()}
          </svg>
        </div>

        <div className="mt-4 grid grid-rows-2 gap-6">
          <div>
            <div className="text-lg font-semibold mb-2">Background</div>
            <div className="text-sm space-y-1">
              <div>This maps shows the best pizza in America.</div>
              <div>It uses the results from the opposite of Google Maps ratings from the Domino's locations - the higher the number, the better the pizza (because Dominos is poorly rated)</div>
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold mb-2">Statistics</div>
            <div className="text-sm space-y-1">
              <div>Total Locations: {reviewData.length}</div>
              <div>
                Average Rating:{" "}
                {(reviewData.reduce((sum, loc) => sum + loc.rating, 0) / reviewData.length).toFixed(2)}
              </div>
              <div>
                Total Reviews:{" "}
                {reviewData.reduce((sum, loc) => sum + loc.total_ratings, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PizzaLocationMap;