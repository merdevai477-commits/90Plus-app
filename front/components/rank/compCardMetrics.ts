/**
 * تحكم في حجم مربعات المسابقات (صف Rank).
 *
 * غيّر COMP_CARD_SCALE فقط:
 * - 0.85 → أصغر
 * - 1.00 → الحجم الافتراضي (Figma)
 * - 1.15 → أكبر
 *
 * أو عدّل COMP_CARD_WIDTH / COMP_CARD_HEIGHT مباشرة (اترك SCALE = 1).
 */

/** المقياس الرئيسي — ابدأي من هنا */
export const COMP_CARD_SCALE = 1;

/** اختياري: عرض/ارتفاع ثابتين (null = احسب من SCALE × Figma) */
export const COMP_CARD_WIDTH_OVERRIDE: number | null = null;
export const COMP_CARD_HEIGHT_OVERRIDE: number | null = null;

const FIGMA = {
  width: 204,
  height: 269,
  borderRadius: 16,
  paddingTop: 134,
  paddingBottom: 16,
  paddingHorizontal: 12,
  contentGap: 14,
  textGap: 4,
  titleGap: 2,
  titleFontSize: 22,
  titleLineHeight: 26,
  titleIconSize: 24,
  subFontSize: 12,
  subLineHeight: 17,
  ctaWidth: 128,
  ctaPaddingV: 10,
  ctaPaddingH: 18,
  ctaFontSize: 14,
  ctaIconSize: 16,
  ctaRadius: 36,
  ctaGap: 4,
} as const;

const round = (value: number) => Math.round(value);

export type CompCardMetrics = {
  width: number;
  height: number;
  borderRadius: number;
  paddingTop: number;
  paddingBottom: number;
  paddingHorizontal: number;
  contentGap: number;
  textGap: number;
  titleGap: number;
  titleFontSize: number;
  titleLineHeight: number;
  titleIconSize: number;
  subFontSize: number;
  subLineHeight: number;
  ctaWidth: number;
  ctaPaddingV: number;
  ctaPaddingH: number;
  ctaFontSize: number;
  ctaIconSize: number;
  ctaRadius: number;
  ctaGap: number;
};

export function getCompCardMetrics(scale = COMP_CARD_SCALE): CompCardMetrics {
  const s = scale;
  return {
    width: COMP_CARD_WIDTH_OVERRIDE ?? round(FIGMA.width * s),
    height: COMP_CARD_HEIGHT_OVERRIDE ?? round(FIGMA.height * s),
    borderRadius: round(FIGMA.borderRadius * s),
    paddingTop: round(FIGMA.paddingTop * s),
    paddingBottom: round(FIGMA.paddingBottom * s),
    paddingHorizontal: round(FIGMA.paddingHorizontal * s),
    contentGap: round(FIGMA.contentGap * s),
    textGap: round(FIGMA.textGap * s),
    titleGap: round(FIGMA.titleGap * s),
    titleFontSize: round(FIGMA.titleFontSize * s),
    titleLineHeight: round(FIGMA.titleLineHeight * s),
    titleIconSize: round(FIGMA.titleIconSize * s),
    subFontSize: round(FIGMA.subFontSize * s),
    subLineHeight: round(FIGMA.subLineHeight * s),
    ctaWidth: round(FIGMA.ctaWidth * s),
    ctaPaddingV: round(FIGMA.ctaPaddingV * s),
    ctaPaddingH: round(FIGMA.ctaPaddingH * s),
    ctaFontSize: round(FIGMA.ctaFontSize * s),
    ctaIconSize: round(FIGMA.ctaIconSize * s),
    ctaRadius: round(FIGMA.ctaRadius * s),
    ctaGap: round(FIGMA.ctaGap * s),
  };
}

/** للاستخدام في rank.tsx لو محتاجة العرض */
export const COMP_CARD_WIDTH = getCompCardMetrics().width;
export const COMP_CARD_HEIGHT = getCompCardMetrics().height;
