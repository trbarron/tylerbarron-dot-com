import { useEffect } from 'react';

interface Photo {
  src: string;
  alt: string;
  caption: string;
}

interface CustomLightboxProps {
  open: boolean;
  close: () => void;
  photos: Photo[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
}

export default function CustomLightbox({ 
  open, 
  close, 
  photos, 
  currentIndex, 
  setCurrentIndex 
}: CustomLightboxProps) {
  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          close();
          break;
        case 'ArrowLeft':
          setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : photos.length - 1);
          break;
        case 'ArrowRight':
          setCurrentIndex(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden'; // Prevent background scroll

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [open, currentIndex, photos.length, close, setCurrentIndex]);

  if (!open) return null;

  const currentPhoto = photos[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : photos.length - 1);
  };

  const goToNext = () => {
    setCurrentIndex(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
      onClick={close}
      onKeyDown={(e) => e.key === 'Enter' && close()}
      role="button"
      tabIndex={0}
    >
      <div 
        className="relative bg-white border-4 border-black max-w-5xl max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="bg-white border-b-4 border-black p-4 flex justify-between items-center">
          <div className="text-black font-extrabold uppercase tracking-wide">
            {currentIndex + 1} of {photos.length}
          </div>
          <button
            onClick={close}
            className="bg-white text-black border-2 border-black px-3 py-1 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white"
          >
            ×
          </button>
        </div>

        {/* Image Container */}
        <div className="relative flex-1 min-h-0 bg-white p-4">
          <img
            src={currentPhoto.src}
            alt={currentPhoto.alt}
            className="w-full h-full object-contain border-2 border-black"
          />
          
          {/* Navigation Buttons */}
          {photos.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-8 top-1/2 transform -translate-y-1/2 bg-white text-black border-4 border-black px-4 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white"
              >
                ←
              </button>
              <button
                onClick={goToNext}
                className="absolute right-8 top-1/2 transform -translate-y-1/2 bg-white text-black border-4 border-black px-4 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white"
              >
                →
              </button>
            </>
          )}
        </div>

        {/* Caption */}
        {currentPhoto.caption && (
          <div className="bg-white border-t-4 border-black p-4">
            <p className="text-black font-semibold uppercase tracking-wide text-center">
              {currentPhoto.caption}
            </p>
          </div>
        )}

        {/* Thumbnail Navigation */}
        {photos.length > 1 && (
          <div className="bg-white border-t-4 border-black p-4 flex justify-center space-x-2 overflow-x-auto">
            {photos.map((photo, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`flex-shrink-0 w-16 h-16 border-2 border-black overflow-hidden ${
                  index === currentIndex ? 'ring-4 ring-black' : 'hover:ring-2 hover:ring-black'
                }`}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 