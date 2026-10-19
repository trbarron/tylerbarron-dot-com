import { useEffect } from 'react';
import Button from '~/components/Button';

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

export default function CustomLightbox({ open, close, photos, currentIndex, setCurrentIndex }: CustomLightboxProps) {
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
      className="bg-opacity-90 fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
      onClick={close}
      onKeyDown={(e) => e.key === 'Enter' && close()}
      role="button"
      tabIndex={0}
    >
      <div
        className="relative flex max-h-full max-w-5xl flex-col border-4 border-black bg-white"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black bg-white p-4">
          <div className="font-extrabold tracking-wide text-black uppercase">
            {currentIndex + 1} of {photos.length}
          </div>
          <Button size="sm" onClick={close} aria-label="Close">
            ×
          </Button>
        </div>

        {/* Image Container */}
        <div className="relative min-h-0 flex-1 bg-white p-4">
          <img
            src={currentPhoto.src}
            alt={currentPhoto.alt}
            className="h-full w-full border-2 border-black object-contain"
          />

          {/* Navigation Buttons */}
          {photos.length > 1 && (
            <>
              <Button
                className="absolute top-1/2 left-8 -translate-y-1/2"
                onClick={goToPrevious}
                aria-label="Previous photo"
              >
                ←
              </Button>
              <Button className="absolute top-1/2 right-8 -translate-y-1/2" onClick={goToNext} aria-label="Next photo">
                →
              </Button>
            </>
          )}
        </div>

        {/* Caption */}
        {currentPhoto.caption && (
          <div className="border-t-4 border-black bg-white p-4">
            <p className="text-center font-semibold tracking-wide text-black uppercase">{currentPhoto.caption}</p>
          </div>
        )}

        {/* Thumbnail Navigation */}
        {photos.length > 1 && (
          <div className="flex justify-center space-x-2 overflow-x-auto border-t-4 border-black bg-white p-4">
            {photos.map((photo, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-16 w-16 flex-shrink-0 overflow-hidden border-2 border-black ${
                  index === currentIndex ? 'ring-4 ring-black' : 'hover:ring-2 hover:ring-black'
                }`}
              >
                <img src={photo.src} alt={photo.alt} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
