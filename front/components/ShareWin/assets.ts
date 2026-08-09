/**
 * Share & Win assets — every entry is the asset exported straight from Figma
 * node 109:470 and committed under assets/images/share-win/.
 *
 * SVGs are rendered with `expo-image` (androidsvg on Android, SDWebImageSVGCoder
 * on iOS), so the committed vector bytes are what ships — nothing is redrawn.
 */

export const SW_ASSET = {
  // Icons
  copy: require('../../assets/images/share-win/icon-copy.svg'),
  linkDiagonal: require('../../assets/images/share-win/icon-link-diagonal.svg'),
  chevronRight: require('../../assets/images/share-win/icon-chevron-right.svg'),
  alertCircle: require('../../assets/images/share-win/icon-alert-circle.svg'),
  gift: require('../../assets/images/share-win/icon-gift.svg'),
  usersDuo: require('../../assets/images/share-win/icon-users-duo.svg'),
  chartLine: require('../../assets/images/share-win/icon-chart-line.svg'),
  star: require('../../assets/images/share-win/icon-star.svg'),
  arrowRight: require('../../assets/images/share-win/icon-arrow-right.svg'),
  xpPolygon: require('../../assets/images/share-win/xp-polygon.svg'),
  dividerVertical: require('../../assets/images/share-win/divider-vertical.svg'),

  // Section rules flanking "الجوائز الأسبوعية"
  ruleLeft: require('../../assets/images/share-win/rule-left.svg'),
  ruleRight: require('../../assets/images/share-win/rule-right.svg'),

  // Lucky wheel
  wheelRing: require('../../assets/images/share-win/wheel-ring.svg'),
  wheelSegA: require('../../assets/images/share-win/wheel-seg-a.svg'),
  wheelSegB: require('../../assets/images/share-win/wheel-seg-b.svg'),
  wheelPointer: require('../../assets/images/share-win/wheel-pointer.svg'),
  wheelDot: require('../../assets/images/share-win/wheel-dot.svg'),

  // Leaderboard medals
  medal1: require('../../assets/images/share-win/medal-1.svg'),
  medal2: require('../../assets/images/share-win/medal-2.svg'),
  medal3: require('../../assets/images/share-win/medal-3.svg'),

  // Share channels
  facebook: require('../../assets/images/share-win/social-facebook.svg'),
  instagram: require('../../assets/images/share-win/social-instagram.svg'),
  whatsapp: require('../../assets/images/share-win/social-whatsapp.svg'),
  snapchat: require('../../assets/images/share-win/social-snapchat.svg'),

} as const;

/**
 * Bundled prize art, keyed by the prize ids the backend ships in
 * `DEFAULT_PRIZES`. A cycle that supplies its own `imageUrl` overrides these.
 */
export const PRIZE_FALLBACK_IMAGE: Record<string, number> = {
  football: require('../../assets/images/share-win/prize-1.png'),
  jersey: require('../../assets/images/share-win/prize-2.png'),
  boots: require('../../assets/images/share-win/prize-3.png'),
  'boots-pro': require('../../assets/images/share-win/prize-4.png'),
};

/** Ordered fallbacks for prizes whose id isn't recognised. */
export const PRIZE_FALLBACK_ORDER = [
  require('../../assets/images/share-win/prize-1.png'),
  require('../../assets/images/share-win/prize-2.png'),
  require('../../assets/images/share-win/prize-3.png'),
  require('../../assets/images/share-win/prize-4.png'),
];

/** Medal art for ranks 1-3; ranks 4+ render a plain number instead. */
export const MEDAL_BY_RANK: Record<number, number> = {
  1: SW_ASSET.medal1,
  2: SW_ASSET.medal2,
  3: SW_ASSET.medal3,
};
