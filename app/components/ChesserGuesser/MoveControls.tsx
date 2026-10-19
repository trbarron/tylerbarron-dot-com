import { formatEval } from '~/utils/chess/evaluation';
import { getImageUrl } from '~/utils/cdn';

const blackKingImage = getImageUrl('ChesserGuesser/blackKing.png');
const whiteKingImage = getImageUrl('ChesserGuesser/whiteKing.png');

interface MoveControlsProps {
  sliderValue: number;
  onSliderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isDisabled: boolean;
  submitLabel?: string;
}

export default function MoveControls({
  sliderValue,
  onSliderChange,
  onSubmit,
  isSubmitting,
  isDisabled,
  submitLabel,
}: MoveControlsProps) {
  const getSubmitText = () => {
    if (isSubmitting) return 'Loading...';
    if (submitLabel) return submitLabel;
    return 'Submit';
  };

  return (
    <>
      {/* Slider */}
      <div className="mt-4 flex w-full gap-2">
        <img src={blackKingImage} alt="Black King" className="h-12 w-12 flex-none" />
        <input
          type="range"
          min="-400"
          max="400"
          value={sliderValue}
          onChange={onSliderChange}
          className="range my-auto h-2 flex-auto cursor-pointer appearance-none border-2 border-black bg-black"
          disabled={isDisabled}
        />
        <img src={whiteKingImage} alt="White King" className="h-12 w-12 flex-none" />
      </div>

      {/* Submit Button */}
      <button
        className="hover:bg-accent font-neo mt-4 flex w-full flex-col items-center border-4 border-black bg-white px-6 py-3 font-extrabold tracking-wide text-black uppercase hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onSubmit}
        disabled={isSubmitting || isDisabled}
      >
        <span className="text-sm">{getSubmitText()}</span>
        <span className="text-sm">{formatEval(sliderValue, { decimals: 2 })}</span>
      </button>
    </>
  );
}
