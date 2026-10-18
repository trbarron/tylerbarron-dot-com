interface MapControlsProps {
  showReviews: boolean;
  setShowReviews: (show: boolean) => void;
  setShowPizzaScore: (show: boolean) => void;
  scoreFilter: number;
  setScoreFilter: (value: number) => void;
}

const MapControls = ({
  showReviews,
  setShowReviews,
  setShowPizzaScore,
  scoreFilter,
  setScoreFilter,
}: MapControlsProps) => {
  const handleVisualizationChange = (mode: string) => {
    if (mode === 'reviews') {
      setShowReviews(true);
      setShowPizzaScore(false);
    } else {
      setShowReviews(false);
      setShowPizzaScore(true);
    }
  };

  return (
    <div className="mb-6 border-4 border-black bg-white p-6">
      <div className="space-y-6">
        {/* Visualization Mode Selection */}
        <div className="space-y-3">
          <div className="font-neo border-b-2 border-black pb-2 text-sm font-extrabold tracking-widest text-black uppercase">
            Visualization Mode
          </div>
          <div className="flex gap-6">
            <label className="group flex cursor-pointer items-center space-x-3">
              <input
                type="radio"
                name="vizMode"
                value="scores"
                checked={!showReviews}
                onChange={() => handleVisualizationChange('scores')}
                className="h-5 w-5 cursor-pointer appearance-none border-2 border-black text-black checked:bg-black focus:ring-0"
              />
              <span className="font-neo font-bold tracking-wide text-black uppercase transition-opacity group-hover:opacity-70">
                Pizza Scores
              </span>
            </label>
            <label className="group flex cursor-pointer items-center space-x-3">
              <input
                type="radio"
                name="vizMode"
                value="reviews"
                checked={showReviews}
                onChange={() => handleVisualizationChange('reviews')}
                className="h-5 w-5 cursor-pointer appearance-none border-2 border-black text-black checked:bg-black focus:ring-0"
              />
              <span className="font-neo font-bold tracking-wide text-black uppercase transition-opacity group-hover:opacity-70">
                Raw Reviews
              </span>
            </label>
          </div>
        </div>

        {/* Score Filter Slider - only shown when in Pizza Scores mode */}
        {!showReviews && (
          <div className="space-y-3">
            <div className="flex items-end justify-between border-b-2 border-black pb-2">
              <div className="font-neo text-sm font-extrabold tracking-widest text-black uppercase">
                Minimum Pizza Score
              </div>
              <div className="font-neo text-2xl leading-none font-black tracking-tighter text-black">
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
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-none border-2 border-black bg-gray-200 accent-black"
            />
            <div className="font-neo flex justify-between text-xs font-bold tracking-widest text-black uppercase opacity-60">
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
