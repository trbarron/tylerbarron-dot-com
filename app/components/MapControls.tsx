
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
    <div className="bg-white border-4 border-black p-6 mb-6">
      <div className="space-y-6">
        {/* Visualization Mode Selection */}
        <div className="space-y-3">
          <div className="font-neo font-extrabold uppercase tracking-widest text-black text-sm border-b-2 border-black pb-2">Visualization Mode</div>
          <div className="flex gap-6">
            <label className="flex items-center space-x-3 cursor-pointer group">
              <input
                type="radio"
                name="vizMode"
                value="scores"
                checked={!showReviews}
                onChange={() => handleVisualizationChange('scores')}
                className="w-5 h-5 border-2 border-black text-black focus:ring-0 cursor-pointer appearance-none checked:bg-black"
              />
              <span className="font-neo font-bold text-black group-hover:opacity-70 transition-opacity uppercase tracking-wide">Pizza Scores</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer group">
              <input
                type="radio"
                name="vizMode"
                value="reviews"
                checked={showReviews}
                onChange={() => handleVisualizationChange('reviews')}
                className="w-5 h-5 border-2 border-black text-black focus:ring-0 cursor-pointer appearance-none checked:bg-black"
              />
              <span className="font-neo font-bold text-black group-hover:opacity-70 transition-opacity uppercase tracking-wide">Raw Reviews</span>
            </label>
          </div>
        </div>

        {/* Score Filter Slider - only shown when in Pizza Scores mode */}
        {!showReviews && (
          <div className="space-y-3">
            <div className="flex justify-between items-end border-b-2 border-black pb-2">
              <div className="font-neo font-extrabold uppercase tracking-widest text-black text-sm">
                Minimum Pizza Score
              </div>
              <div className="font-neo font-black text-2xl tracking-tighter text-black leading-none">
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
              className="w-full h-2 bg-gray-200 rounded-none appearance-none cursor-pointer border-2 border-black accent-black"
            />
            <div className="flex justify-between font-neo font-bold text-xs text-black opacity-60 uppercase tracking-widest">
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