export const KING_ART = {
  stadium: require('../../assets/images/king-of-predictions/stadium-bg.png'),
  confetti: require('../../assets/images/king-of-predictions/confetti.png'),
  confettiPrize: require('../../assets/images/king-of-predictions/confetti-prize.png'),
  prizeBg: require('../../assets/images/king-of-predictions/prize-bg.png'),
  prizeGlow1: require('../../assets/images/king-of-predictions/prize-glow-1.svg'),
  prizeGlow2: require('../../assets/images/king-of-predictions/prize-glow-2.png'),
  shirt1: require('../../assets/images/king-of-predictions/shirt-1.png'),
  shirt2: require('../../assets/images/king-of-predictions/shirt-2.png'),
  shirtShadow: require('../../assets/images/king-of-predictions/shirt-shadow.png'),
  emptyBlob: require('../../assets/images/king-of-predictions/empty-blob.svg'),
  emptyGoal: require('../../assets/images/king-of-predictions/empty-goal.png'),
  scoreBox: require('../../assets/images/king-of-predictions/score-box.svg'),
} as const;

export const KING_ICON = {
  trophy: require('../../assets/images/king-of-predictions/trophy.svg'),
  trophyBoard: require('../../assets/images/king-of-predictions/trophy-board.svg'),
  crown: require('../../assets/images/king-of-predictions/crown.svg'),
  medal1: require('../../assets/images/king-of-predictions/medal-1.svg'),
  medal2: require('../../assets/images/king-of-predictions/medal-2.svg'),
  medal3: require('../../assets/images/king-of-predictions/medal-3.svg'),
  user: require('../../assets/images/king-of-predictions/icon-user.svg'),
  arrowLeft: require('../../assets/images/king-of-predictions/icon-arrow-left.svg'),
  chevron: require('../../assets/images/king-of-predictions/icon-chevron.svg'),
  energy: require('../../assets/images/king-of-predictions/icon-energy.svg'),
  ranking: require('../../assets/images/king-of-predictions/icon-ranking.svg'),
  drawX: require('../../assets/images/king-of-predictions/draw-x.svg'),
  drawXGlow: require('../../assets/images/king-of-predictions/draw-x-glow.png'),
  close: require('../../assets/images/king-of-predictions/close.svg'),
  info: require('../../assets/images/king-of-predictions/icon-info.svg'),
} as const;

/** League badges from the Figma "الدوريات الكبرى" card, right-to-left order. */
export const KING_LEAGUE_BADGES = [
  { key: 'pl', source: require('../../assets/images/king-of-predictions/league-pl.png'), width: 17, height: 28 },
  { key: 'laliga', source: require('../../assets/images/king-of-predictions/league-laliga.png'), width: 25, height: 19 },
  { key: 'seriea', source: require('../../assets/images/king-of-predictions/league-seriea.png'), width: 15, height: 26 },
  { key: 'bundesliga', source: require('../../assets/images/king-of-predictions/league-bundesliga.png'), width: 20, height: 20 },
  { key: 'ligue1', source: require('../../assets/images/king-of-predictions/league-ligue1.png'), width: 20, height: 28 },
  { key: 'botola', source: require('../../assets/images/king-of-predictions/league-botola.png'), width: 18, height: 28 },
  { key: 'dark', source: require('../../assets/images/king-of-predictions/league-dark.png'), width: 34, height: 34, cover: true },
  { key: 'saudi', source: require('../../assets/images/king-of-predictions/league-saudi.png'), width: 18, height: 26 },
  { key: 'palestine', source: require('../../assets/images/king-of-predictions/league-palestine.png'), width: 24, height: 22 },
] as const;
