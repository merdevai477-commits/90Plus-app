/**
 * Match Details Color Palette
 * Unified colors matching match-details.tsx design
 */

export const MATCH_DETAILS_COLORS = {
  background: '#0f0720',
  card: '#1a1a1a',
  cardSecondary: '#252525',
  text: '#fff',
  textSecondary: '#888',
  textTertiary: '#666',
  accent: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  blue: '#3b82f6',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.1)',
} as const;

/**
 * Animation configurations
 */
export const ANIMATION_CONFIG = {
  spring: {
    damping: 12,
    stiffness: 150,
  },
  fadeInDuration: 400,
  staggerDelay: 50,
  pulseDuration: 2000,
} as const;
