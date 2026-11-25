export type PPColors = {
  bg: string;
  ink: string;
  card: string;
  muted: string;
  soft: string;
  primary: string;
  primarySoft: string;
  primaryDeep: string;
  primaryDark: string;
  pale: string;
  hero: string;
  heroSide: string;
  jersey: string;
  softLilac: string;
  border: string;
  divider: string;
  shadow: string;
  transferFee: string;
  ratingLabel: string;
  bar: string;
  statusText: string;
  cardYellow: string;
  cardRed: string;
  ratingText: string;
  radarFill: string;
  radarStroke: string;
  timelineInactive: string;
  /** Legacy aliases used by match-context player-profile screen */
  timeline: string;
  statLabel: string;
  dateLilac: string;
  transferLilac: string;
  seasonLabel: string;
};

export const PP_LIGHT: PPColors = {
  bg: '#f9f6fe',
  ink: '#24104e',
  card: '#ffffff',
  muted: '#6b7387',
  soft: 'rgba(36,16,78,0.75)',
  primary: '#6a2bd9',
  primarySoft: '#8b5cf6',
  primaryDeep: '#2e146a',
  primaryDark: '#4b1fa3',
  pale: '#f3edff',
  hero: '#230e48',
  heroSide: '#271051',
  jersey: '#000000',
  softLilac: '#e9d5ff',
  border: '#e8e0f5',
  divider: '#e8e0f5',
  shadow: '#4b1fa3',
  transferFee: '#4b1fa3',
  ratingLabel: '#e9d5ff',
  bar: '#230e48',
  statusText: '#24104e',
  cardYellow: '#fdac0c',
  cardRed: '#B60505',
  ratingText: '#272727',
  radarFill: 'rgba(106,43,217,0.35)',
  radarStroke: '#6a2bd9',
  timelineInactive: '#d4c4f5',
  timeline: '#e8e0f5',
  statLabel: '#6a2bd9',
  dateLilac: '#6a2bd9',
  transferLilac: '#6a2bd9',
  seasonLabel: '#6a2bd9',
};

export const PP_DARK: PPColors = {
  bg: '#08060f',
  ink: 'rgba(255,255,255,0.92)',
  card: '#120a22',
  muted: 'rgba(255,255,255,0.55)',
  soft: 'rgba(255,255,255,0.75)',
  primary: '#a78bfa',
  primarySoft: '#a78bfa',
  primaryDeep: '#2e146a',
  primaryDark: '#8b5cf6',
  pale: '#1a0f30',
  hero: '#230e48',
  heroSide: '#271051',
  jersey: 'rgba(255,255,255,0.72)',
  softLilac: '#e9d5ff',
  border: '#2a2040',
  divider: '#2a2040',
  shadow: '#000000',
  transferFee: '#c4b5fd',
  ratingLabel: '#e9d5ff',
  bar: '#0c051a',
  statusText: 'rgba(255,255,255,0.75)',
  cardYellow: '#fdac0c',
  cardRed: '#B60505',
  ratingText: '#272727',
  radarFill: 'rgba(167,139,250,0.35)',
  radarStroke: '#a78bfa',
  timelineInactive: '#3b2a5c',
  timeline: '#211930',
  statLabel: '#CFBCFA',
  dateLilac: '#CC9EF8',
  transferLilac: '#D1A7F9',
  seasonLabel: '#B67CEE',
};

/** @deprecated Prefer getPPColors(isDark). Kept for match-context player-profile screen. */
export const PP_COLORS = PP_DARK;

export function getPPColors(isDark: boolean): PPColors {
  return isDark ? PP_DARK : PP_LIGHT;
}

export function ratingTone(rating: number): string {
  if (rating >= 7) return '#70F782';
  if (rating >= 6) return '#FDBE3D';
  return '#FF8A7A';
}
