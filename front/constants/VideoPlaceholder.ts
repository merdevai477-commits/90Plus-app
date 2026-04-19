/**
 * Video Thumbnail Placeholder
 * 
 * Provides a default placeholder for video thumbnails when thumbnail generation fails.
 * This ensures a consistent user experience and prevents empty/black spaces.
 * 
 * Requirement 2.12: Display default image when thumbnail generation fails
 */

// Using a solid color placeholder with a play icon overlay
// This is more reliable than using an external image URL
export const VIDEO_THUMBNAIL_PLACEHOLDER = {
  // Fallback color for when thumbnail is null
  backgroundColor: '#1a1a1a',
  
  // Alternative: Use a default image from assets
  // If you want to use an actual image, uncomment and add the image to assets
  // defaultImage: require('../assets/images/video-placeholder.png'),
  
  // For remote fallback (less reliable, requires network)
  defaultRemoteUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300&h=500&fit=crop',
};

/**
 * Helper function to get a valid thumbnail URI
 * Returns the thumbnail if available, otherwise returns a placeholder
 */
export function getThumbnailUri(thumbnail: string | null | undefined): string | null {
  if (thumbnail && thumbnail.trim() !== '') {
    return thumbnail;
  }
  // Return null to indicate we should show a placeholder component
  // rather than trying to load an invalid image
  return null;
}

/**
 * Check if a thumbnail is valid
 */
export function isValidThumbnail(thumbnail: string | null | undefined): boolean {
  return thumbnail !== null && thumbnail !== undefined && thumbnail.trim() !== '';
}
