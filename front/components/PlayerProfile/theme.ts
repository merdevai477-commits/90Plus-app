export const PP_COLORS = {
  bg: '#030303',
  bar: '#0c051a',
  card: '#0b0518',
  border: '#281359',
  divider: '#200A53',
  primary: '#8b5cf6',
  primarySoft: '#a78bfa',
  primaryDeep: '#2e146a',
  timeline: '#211930',
  jersey: '#21163b',
  muted: 'rgba(255,255,255,0.55)',
  soft: 'rgba(255,255,255,0.75)',
} as const;

export function ratingTone(rating: number): string {
  if (rating >= 7) return '#86EFAC';
  if (rating >= 6) return '#FACC15';
  return '#ff8a7a';
}
