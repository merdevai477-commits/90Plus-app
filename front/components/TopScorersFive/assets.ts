/**
 * Art for the "خماسي الهدافين" intro screen (Figma 1259:8321).
 *
 * The five league badges are the ones already shipped for King of Predictions
 * — the Figma intro uses the same five logos, so they are re-exported here in
 * the order and box sizes the intro design lays them out in (design frame is
 * 448pt wide; `TopScorersFiveScreen` scales these to the device).
 */

/**
 * Full-bleed art not exported from Figma yet. Until each file lands in
 * assets/images/top-scorers-five/ its screen draws a fallback — a `require` of a
 * missing file breaks the whole Metro bundle, not just this screen.
 *   hero  → layer "ChatGPT Image Oct 3, 2026, 10_06_18 AM 1" (intro, 1259:8321)
 *   pitch → layer "ChatGPT Image Oct 2, 2026, 11_47_05 PM 1" (pick, 1263:10333),
 *           saved as pitch.png
 */
export const TSF_ART: { hero: number | null; pitch: number | null } = {
  hero: null,
  pitch: null,
};

export type TsfLeagueKey = 'pl' | 'laliga' | 'bundesliga' | 'seriea' | 'ligue1';

export const TSF_LEAGUE_LOGO: Record<TsfLeagueKey, number> = {
  pl: require('../../assets/images/king-of-predictions/league-pl.png'),
  laliga: require('../../assets/images/king-of-predictions/league-laliga.png'),
  bundesliga: require('../../assets/images/king-of-predictions/league-bundesliga.png'),
  seriea: require('../../assets/images/king-of-predictions/league-seriea.png'),
  ligue1: require('../../assets/images/king-of-predictions/league-ligue1.png'),
};

export type TsfLeagueBadge = {
  readonly key: string;
  readonly source: number;
  /** Card box in the 448pt design frame. */
  readonly card: { left: number; top: number; width: number; height: number };
  /** Logo box inside the card, also in design units. */
  readonly logo: { width: number; height: number };
  /** The Premier League card sits higher and carries the purple ring. */
  readonly featured?: boolean;
};

/**
 * Design coordinates come from Figma "Frame 718" (402×97 at y=617). The frame
 * clips nothing, and the Premier League card overflows 21pt above it, so every
 * `top` below is shifted by +21 into a 402×138 container.
 */
export const TSF_LEAGUE_BADGES: readonly TsfLeagueBadge[] = [
  {
    key: 'ligue1',
    source: require('../../assets/images/king-of-predictions/league-ligue1.png'),
    card: { left: 3, top: 45, width: 82, height: 88 },
    logo: { width: 49, height: 49 },
  },
  {
    key: 'seriea',
    source: require('../../assets/images/king-of-predictions/league-seriea.png'),
    card: { left: 75, top: 41, width: 90, height: 97 },
    logo: { width: 50, height: 85 },
  },
  {
    key: 'bundesliga',
    source: require('../../assets/images/king-of-predictions/league-bundesliga.png'),
    card: { left: 237, top: 41, width: 90, height: 97 },
    logo: { width: 67, height: 67 },
  },
  {
    key: 'laliga',
    source: require('../../assets/images/king-of-predictions/league-laliga.png'),
    card: { left: 314, top: 45, width: 82, height: 88 },
    logo: { width: 62, height: 48 },
  },
  {
    key: 'pl',
    source: require('../../assets/images/king-of-predictions/league-pl.png'),
    card: { left: 146, top: 0, width: 111, height: 120 },
    logo: { width: 60, height: 100 },
    featured: true,
  },
] as const;

/** Width of the Figma frame every design unit above is measured against. */
export const TSF_DESIGN_WIDTH = 448;
