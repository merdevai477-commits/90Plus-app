// ─── 90Plus Design Tokens — Single Source of Truth ───────────────────────────
// Logo identity: Purple + Electric Blue + Gold on deep dark

// ── Background ────────────────────────────────────────────────────────────────
export const BG_BASE    = '#05010D';
export const BG_MID     = '#0A051A';
export const BG_SURFACE = '#05010D';

// ── Purple system (primary) ───────────────────────────────────────────────────
export const PURPLE_PRIMARY = '#7C3AED';
export const PURPLE_DARK    = '#5B21B6';
export const PURPLE_SOFT    = '#A78BFA';
export const PURPLE_GLOW    = 'rgba(124,58,237,0.35)';
export const PURPLE_GLOW_SM = 'rgba(124,58,237,0.15)';
export const PURPLE_GLOW_XS = 'rgba(124,58,237,0.08)';

// ── Electric Blue system (logo accent) ───────────────────────────────────────
export const BLUE_PRIMARY  = '#3B82F6';
export const BLUE_ELECTRIC = '#60A5FA';
export const BLUE_GLOW     = 'rgba(59,130,246,0.3)';
export const BLUE_SOFT     = 'rgba(96,165,250,0.15)';
export const BLUE_GLOW_SM  = 'rgba(59,130,246,0.12)';
export const BLUE_GLOW_XS  = 'rgba(59,130,246,0.08)';

// ── Gold system ───────────────────────────────────────────────────────────────
export const GOLD_PRIMARY = '#F5C518';
export const GOLD_DARK    = '#D4A017';
export const GOLD_GLOW    = 'rgba(245,197,24,0.4)';
export const GOLD_SOFT    = 'rgba(212,160,23,0.22)';

// ── Glass surfaces ────────────────────────────────────────────────────────────
export const GLASS_CARD         = 'rgba(255,255,255,0.06)';
export const GLASS_BORDER_TOP   = 'rgba(255,255,255,0.12)';
export const GLASS_BORDER_SIDE  = 'rgba(255,255,255,0.05)';
export const GLASS_BORDER_BOTTOM = 'rgba(255,255,255,0.02)';

// ── Text ──────────────────────────────────────────────────────────────────────
export const TEXT_PRIMARY   = '#FFFFFF';
export const TEXT_SECONDARY = 'rgba(255,255,255,0.75)';
export const TEXT_MUTED     = 'rgba(255,255,255,0.4)';
export const TEXT_DISABLED  = 'rgba(255,255,255,0.2)';

// ── Semantic ──────────────────────────────────────────────────────────────────
export const LIVE_RED    = '#ef4444';
export const RATING_GOLD  = '#FFD700';
export const RATING_GREEN = '#32CD32';
export const RATING_TEAL  = '#11998E';

// ── Tab colors ────────────────────────────────────────────────────────────────
export const TAB_COLORS = {
  Home:       '#f59e0b',
  Leagues:    '#3B82F6',
  Quiz:       '#3B82F6',
  AI:         '#a855f7',
  Profile:    '#a855f7',
  Highlights: '#ef4444',
  Rank:       '#ec4899',
} as const;

// ── Unified radii (hubs, cards, chips) ────────────────────────────────────────
export const RADIUS_SM = 10;
export const RADIUS_MD = 14;
export const RADIUS_LG = 18;
export const RADIUS_XL = 20;

export const BORDER_ARENA = 'rgba(255,255,255,0.1)';
export const BORDER_ARENA_STRONG = 'rgba(255,255,255,0.12)';

/** Root shell background — same on every tab screen */
export const GRADIENT_BG_COLORS = [BG_BASE, BG_MID, BG_SURFACE, BG_BASE] as const;
export const GRADIENT_BG_LOCATIONS = [0, 0.3, 0.7, 1] as const;

/** Hub hero strips */
export const GRADIENT_HERO_PURPLE_BLUE = ['rgba(124,58,237,0.22)', 'rgba(59,130,246,0.1)', 'transparent'] as const;
export const GRADIENT_HERO_RANK = ['rgba(236,72,153,0.18)', 'rgba(124,58,237,0.08)', 'transparent'] as const;
export const GRADIENT_HERO_REELS = ['rgba(239,68,68,0.18)', 'rgba(124,58,237,0.08)', 'transparent'] as const;

/** Quiz streak card base */
export const GRADIENT_QUIZ_STREAK = ['rgba(245,197,24,0.12)', 'rgba(124,58,237,0.08)', 'rgba(8,6,14,0.95)'] as const;

/** Primary buttons */
export const GRADIENT_CTA_PURPLE = [PURPLE_PRIMARY, PURPLE_DARK] as const;

/** Modal / system overlays */
export const OVERLAY_SCRIM = 'rgba(0,0,0,0.72)';
export const SURFACE_MODAL = 'rgba(14,11,22,0.98)';

/** Mirrors TAB_COLORS for surfaces (badges, rails) */
export const ACCENT_ROUTE = {
  home: TAB_COLORS.Home,
  leagues: TAB_COLORS.Leagues,
  quiz: TAB_COLORS.Quiz,
  ai: TAB_COLORS.AI,
  profile: TAB_COLORS.Profile,
  highlights: TAB_COLORS.Highlights,
  rank: TAB_COLORS.Rank,
} as const;

// ── Layout (home + lists) — use instead of magic numbers ─────────────────────
export const SCREEN_PADDING_H = 16;
export const SECTION_GAP = 24;
export const SECTION_HEADER_TO_CONTENT = 10;
