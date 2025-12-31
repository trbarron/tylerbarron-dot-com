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
      <div className="gap-2 flex w-full mt-4">
        <img src={blackKingImage} alt="Black King" className="w-12 h-12 flex-none" />
        <input
          type="range"
          min="-400"
          max="400"
          value={sliderValue}
          onChange={onSliderChange}
          className="range flex-auto cursor-pointer appearance-none bg-black h-2 my-auto border-2 border-black"
          disabled={isDisabled}
        />
        <img src={whiteKingImage} alt="White King" className="w-12 h-12 flex-none" />
      </div>

      {/* Submit Button */}
      <button
        className="w-full bg-white text-black border-4 border-black px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center font-neo mt-4"
        onClick={onSubmit}
        disabled={isSubmitting || isDisabled}
      >
        <span className="text-sm">{getSubmitText()}</span>
        <span className="text-sm">{(sliderValue / 100).toFixed(2)}</span>
      </button>
    </>
  );
}
