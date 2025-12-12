/**
 * CDN utility for serving static assets from S3/CloudFront
 * This keeps images out of the Lambda bundle and improves performance
 */

// CDN base URL from environment or fallback to S3 direct URL
const CDN_URL = (import.meta.env.VITE_CDN_URL || process.env.CDN_URL || process.env.AWS_BUCKET_URL || '') as string;

// For local development, you can use a different URL or empty string to use relative paths
const isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/**
 * Get the full URL for an image served from CDN
 *
 * @param path - Relative path to the image (e.g., 'SSBM/falco1.jpg')
 * @returns Full URL to the image on CDN
 *
 * @example
 * // In your component:
 * import { getImageUrl } from '~/utils/cdn';
 *
 * <img src={getImageUrl('SSBM/falco1.jpg')} alt="Falco" />
 */
export function getImageUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.replace(/^\//, '');

  // In development, you might want to serve from local public directory
  if (isDevelopment && !CDN_URL) {
    return `/images/${cleanPath}`;
  }

  // Ensure CDN_URL doesn't have trailing slash or /images suffix
  const baseUrl = CDN_URL.replace(/\/$/, '').replace(/\/images$/, '');

  return `${baseUrl}/images/${cleanPath}`;
}

/**
 * Preload an image for performance optimization
 * Useful for above-the-fold images
 *
 * @param path - Relative path to the image
 *
 * @example
 * // In your route loader:
 * import { preloadImage } from '~/utils/cdn';
 *
 * export function links() {
 *   return [
 *     { rel: 'preload', href: preloadImage('hero.jpg'), as: 'image' }
 *   ];
 * }
 */
export function preloadImage(path: string): string {
  return getImageUrl(path);
}

/**
 * Get srcset for responsive images
 * Assumes you have generated responsive image sizes (400w, 800w, 1200w)
 *
 * @param basePath - Path without extension (e.g., 'SSBM/falco1')
 * @param extension - File extension (default: 'jpg')
 * @returns srcset string for responsive images
 *
 * @example
 * <img
 *   srcSet={getResponsiveSrcSet('SSBM/falco1', 'webp')}
 *   sizes="(max-width: 768px) 100vw, 50vw"
 *   src={getImageUrl('SSBM/falco1.jpg')}
 * />
 */
export function getResponsiveSrcSet(
  basePath: string,
  extension: string = 'jpg'
): string {
  const sizes = [400, 800, 1200];
  return sizes
    .map(width => `${getImageUrl(`${basePath}-${width}.${extension}`)} ${width}w`)
    .join(', ');
}

/**
 * Generate picture element sources for modern image formats
 * Supports WebP and AVIF with fallback to original format
 *
 * @param basePath - Path without extension
 * @param originalExt - Original file extension
 * @returns Object with srcSets for different formats
 *
 * @example
 * const sources = getModernImageSources('SSBM/falco1', 'jpg');
 *
 * <picture>
 *   <source type="image/avif" srcSet={sources.avif} />
 *   <source type="image/webp" srcSet={sources.webp} />
 *   <img src={sources.fallback} alt="..." />
 * </picture>
 */
export function getModernImageSources(
  basePath: string,
  originalExt: string = 'jpg'
) {
  return {
    avif: getResponsiveSrcSet(basePath, 'avif'),
    webp: getResponsiveSrcSet(basePath, 'webp'),
    fallback: getImageUrl(`${basePath}.${originalExt}`),
  };
}

/**
 * Type-safe image paths
 * Add your image directories here for autocomplete
 */
export type ImageDirectory =
  | 'SSBM'
  | 'CamelUpCup'
  | 'CatTracker'
  | 'ChesserGuesser'
  | 'GenerativeArt'
  | 'Global'
  | 'Riddler'
  | 'Set';

/**
 * Helper to ensure type-safe image paths
 */
export function image(dir: ImageDirectory, filename: string): string {
  return getImageUrl(`${dir}/${filename}`);
}
