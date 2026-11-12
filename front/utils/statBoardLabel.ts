/**
 * The rating leaderboard is supplied as "365 Ratings" / "تقييم 365".
 * Show the product name on every platform.
 */
export function statBoardLabel(
  board: { name?: string | null; typeId?: number | null; key?: number | null },
  language: string,
  fallback: string,
): string {
  const type = board.typeId ?? board.key;
  const name = (board.name || '').trim();
  const isRatingBoard =
    type === 36 ||
    /^365\s*ratings?$/i.test(name) ||
    (/365/.test(name) && /rating|تقييم/i.test(name));
  if (isRatingBoard) return language === 'ar' ? 'تقييم 90plus' : '90plus rating';
  return name || fallback;
}
