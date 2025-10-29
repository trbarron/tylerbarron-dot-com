
interface MapControlsProps {
  showReviews: boolean;
  setShowReviews: (show: boolean) => void;
  setShowPizzaScore: (show: boolean) => void;
  setShowPerfectRatings: (show: boolean) => void;
  scoreFilter: number;
  setScoreFilter: (value: number) => void;
}

const MapControls = ({
    showReviews,
    setShowReviews,
    setShowPizzaScore,
    setShowPerfectRatings,
    scoreFilter,
    setScoreFilter,
  }: MapControlsProps) => {

  const handleVisualizationChange = (mode: string) => {
    if (mode === 'reviews') {
      setShowReviews(true);
      setShowPizzaScore(false);
      setShowPerfectRatings(false);
    } else {
      setShowReviews(false);
      setShowPizzaScore(true);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="space-y-6">
        {/* Visualization Mode Selection */}
        <div className="space-y-3">
          <div className="text-base font-semibold">Visualization Mode</div>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="vizMode"
                value="scores"
                checked={!showReviews}
                onChange={() => handleVisualizationChange('scores')}
                className="form-radio"
              />
              <span>Pizza Scores</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="vizMode"
                value="reviews"
                checked={showReviews}
                onChange={() => handleVisualizationChange('reviews')}
                className="form-radio"
              />
              <span>Raw Reviews</span>
            </label>
          </div>
        </div>

        {/* Score Filter Slider - only shown when in Pizza Scores mode */}
        {!showReviews && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-base font-semibold">
                Minimum Pizza Score
              </div>
              <div className="text-sm font-medium">
                {scoreFilter.toFixed(1)}
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="4.9"
              step="0.1"
              value={scoreFilter}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setScoreFilter(value);
                setShowPerfectRatings(value >= 5);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>0</span>
              <span>4.9</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapControls;