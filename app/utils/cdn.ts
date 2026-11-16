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
