import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

interface PhotoGalleryProps {
  images: string[];
  layout?: 'grid' | 'masonry';
  lightbox?: boolean;
  alt?: string;
  className?: string;
}

/**
 * PhotoGallery component for displaying image galleries
 * with optional lightbox functionality.
 *
 * @example
 * ```tsx
 * <PhotoGallery
 *   images={['/img1.jpg', '/img2.jpg']}
 *   layout="grid"
 *   lightbox
 * />
 * ```
 */
export default function PhotoGallery({
  images,
  layout = 'grid',
  lightbox = true,
  alt = 'Gallery image',
  className = '',
}: PhotoGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleImageClick = (index: number) => {
    if (lightbox) {
      setCurrentIndex(index);
      setIsOpen(true);
    }
  };

  const gridClass = layout === 'grid'
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
    : 'columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4';

  const slides = images.map(src => ({ src }));

  return (
    <>
      <div className={`${gridClass} ${className}`}>
        {images.map((src, index) => (
          <div
            key={src}
            className={lightbox ? 'cursor-pointer' : ''}
            onClick={() => handleImageClick(index)}
          >
            <img
              src={src}
              alt={`${alt} ${index + 1}`}
              className="w-full h-auto object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
        ))}
      </div>

      {lightbox && (
        <Lightbox
          open={isOpen}
          close={() => setIsOpen(false)}
          slides={slides}
          index={currentIndex}
        />
      )}
    </>
  );
}

export type { PhotoGalleryProps };
