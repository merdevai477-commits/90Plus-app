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
  statLabel: '#CFBCFA',
  dateLilac: '#CC9EF8',
  transferLilac: '#D1A7F9',
  seasonLabel: '#B67CEE',
  ratingText: '#272727',
  cardYellow: '#FDAC0B',
  cardRed: '#B60505',
} as const;

export function ratingTone(rating: number): string {
  if (rating >= 7) return '#70F782';
  if (rating >= 6) return '#FDBE3D';
  return '#FF8A7A';
}
