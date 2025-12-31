import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

interface Photo {
  src: string;
  alt?: string;
  caption?: string;
}

interface PhotoGalleryProps {
  images: string[] | Photo[];
  layout?: 'grid' | 'masonry' | 'inline';
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
 * // Simple string array
 * <PhotoGallery
 *   images={['/img1.jpg', '/img2.jpg']}
 *   layout="grid"
 *   lightbox
 * />
 *
 * // With captions and custom alt text
 * <PhotoGallery
 *   images={[
 *     { src: '/img1.jpg', alt: 'Photo 1', caption: 'A beautiful sunset' },
 *     { src: '/img2.jpg', alt: 'Photo 2', caption: 'Mountain view' }
 *   ]}
 *   layout="inline"
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

  // Normalize images to Photo objects
  const photos: Photo[] = images.map((img, index) =>
    typeof img === 'string'
      ? { src: img, alt: `${alt} ${index + 1}` }
      : { ...img, alt: img.alt || `${alt} ${index + 1}` }
  );

  const handleImageClick = (index: number) => {
    if (lightbox) {
      setCurrentIndex(index);
      setIsOpen(true);
    }
  };

  const getLayoutClass = () => {
    if (layout === 'grid') {
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    } else if (layout === 'masonry') {
      return 'columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4';
    }
    // inline layout has no wrapper class
    return '';
  };

  const getImageClass = () => {
    if (layout === 'inline') {
      return 'max-w-full h-auto';
    }
    return 'w-full h-auto object-cover rounded-lg hover:opacity-90 transition-opacity';
  };

  const slides = photos.map(photo => ({ src: photo.src }));

  const renderPhoto = (photo: Photo, index: number) => (
    <div
      key={photo.src}
      className={`${lightbox ? 'cursor-pointer' : ''} ${layout === 'inline' ? 'my-5' : ''}`}
      onClick={() => handleImageClick(index)}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        className={getImageClass()}
      />
      {photo.caption && (
        <p className="italic mt-2.5">{photo.caption}</p>
      )}
    </div>
  );

  const containerClass = getLayoutClass();

  return (
    <>
      {containerClass ? (
        <div className={`${containerClass} ${className}`}>
          {photos.map((photo, index) => renderPhoto(photo, index))}
        </div>
      ) : (
        // Inline layout - no wrapper
        <>{photos.map((photo, index) => renderPhoto(photo, index))}</>
      )}

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

export type { PhotoGalleryProps, Photo };
