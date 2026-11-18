/**
 * Share & Win assets — legacy pack (109:470) + v2 icons from Frame123 (1997:5301).
 */

export const SW_ASSET = {
  // Icons (legacy)
  copy: require('../../assets/images/share-win/icon-copy.svg'),
  linkDiagonal: require('../../assets/images/share-win/icon-link-diagonal.svg'),
  chevronRight: require('../../assets/images/share-win/icon-chevron-right.svg'),
  chevronDown: require('../../assets/images/share-win/icon-chevron-down.svg'),
  alertCircle: require('../../assets/images/share-win/icon-alert-circle.svg'),
  gift: require('../../assets/images/share-win/icon-gift.svg'),
  usersDuo: require('../../assets/images/share-win/icon-users-duo.svg'),
  chartLine: require('../../assets/images/share-win/icon-chart-line.svg'),
  star: require('../../assets/images/share-win/icon-star.svg'),
  arrowRight: require('../../assets/images/share-win/icon-arrow-right.svg'),
  xpPolygon: require('../../assets/images/share-win/xp-polygon.svg'),
  dividerVertical: require('../../assets/images/share-win/divider-vertical.svg'),
  bell: require('../../assets/images/share-win/icon-bell.svg'),

  // Section rules flanking "الجوائز الشهرية"
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

  // Share channels (legacy fallbacks)
  facebook: require('../../assets/images/share-win/social-facebook.svg'),
  instagram: require('../../assets/images/share-win/social-instagram.svg'),
  whatsapp: require('../../assets/images/share-win/social-whatsapp.svg'),
  snapchat: require('../../assets/images/share-win/social-snapchat.svg'),

  // ── Frame123 / v2 ─────────────────────────────────────────────────────────
  giftV2: require('../../assets/images/share-win-v2/icon-gift.svg'),
  medal1stV2: require('../../assets/images/share-win-v2/icon-medal-1st.svg'),
  rankingV2: require('../../assets/images/share-win-v2/icon-ranking.svg'),
  clockV2: require('../../assets/images/share-win-v2/icon-clock.svg'),
  colonDots: require('../../assets/images/share-win-v2/colon-dots.svg'),
  podiumTop1: require('../../assets/images/share-win-v2/podium-top-1.svg'),
  podiumTop2: require('../../assets/images/share-win-v2/podium-top-2.svg'),
  podiumTop3: require('../../assets/images/share-win-v2/podium-top-3.svg'),
  chevronDownV2: require('../../assets/images/share-win-v2/icon-chevron-down.svg'),
  linkV2: require('../../assets/images/share-win-v2/icon-link.svg'),
  copyV2: require('../../assets/images/share-win-v2/icon-copy.svg'),
  facebookV2: require('../../assets/images/share-win-v2/social-facebook.svg'),
  instagramV2: require('../../assets/images/share-win-v2/social-instagram.svg'),
  whatsappV2: require('../../assets/images/share-win-v2/social-whatsapp.svg'),
  snapchatV2: require('../../assets/images/share-win-v2/social-snapchat.svg'),
  statusBullet: require('../../assets/images/share-win-v2/status-bullet.svg'),
  backV2: require('../../assets/images/share-win-v2/icon-back.svg'),
  rankV2: require('../../assets/images/share-win-v2/icon-rank.svg'),
  dividerLineV2: require('../../assets/images/share-win-v2/divider-line.svg'),
  shareV2: require('../../assets/images/share-win-v2/icon-share.svg'),
  coinsV2: require('../../assets/images/share-win-v2/icon-coins.svg'),
  /** Full prize card art from Figma 2010:5799 (compressed JPEG). */
  prizeFeaturedBg: require('../../assets/images/share-win-v2/prize-featured-bg.jpg'),
  prizeSecondaryBg: require('../../assets/images/share-win-v2/prize-secondary-bg.jpg'),
  prizeJerseysRow: require('../../assets/images/share-win-v2/prize-jerseys-row.jpg'),
  shareCardTexture: require('../../assets/images/share-win-v2/share-card-texture.jpg'),
} as const;

/**
 * Bundled prize art, keyed by the prize ids the backend ships in
 * `DEFAULT_PRIZES`. A cycle that supplies its own `imageUrl` overrides these.
 */
export const PRIZE_FALLBACK_IMAGE: Record<string, number> = {
  ps5: require('../../assets/images/share-win/prize-ps5.png'),
  kit: require('../../assets/images/share-win/prize-kit.png'),
  'kit-2': require('../../assets/images/share-win/prize-kit.png'),
  jersey: require('../../assets/images/share-win/prize-jersey-sm.png'),
  'jersey-2': require('../../assets/images/share-win/prize-jersey-sm.png'),
  'jersey-3': require('../../assets/images/share-win/prize-jersey-sm.png'),
  'jersey-4': require('../../assets/images/share-win/prize-jersey-sm.png'),
  football: require('../../assets/images/share-win/prize-jersey-sm.png'),
  boots: require('../../assets/images/share-win/prize-jersey-sm.png'),
  'boots-pro': require('../../assets/images/share-win/prize-jersey-sm.png'),
};

/** Ordered fallbacks: 1st PS5, 2nd/3rd kit, then jerseys only. */
export const PRIZE_FALLBACK_ORDER = [
  require('../../assets/images/share-win/prize-ps5.png'),
  require('../../assets/images/share-win/prize-kit.png'),
  require('../../assets/images/share-win/prize-kit.png'),
  require('../../assets/images/share-win/prize-jersey-sm.png'),
  require('../../assets/images/share-win/prize-jersey-sm.png'),
];

/** Medal art for ranks 1-3; ranks 4+ render a plain number instead. */
export const MEDAL_BY_RANK: Record<number, number> = {
  1: SW_ASSET.medal1,
  2: SW_ASSET.medal2,
  3: SW_ASSET.medal3,
};
