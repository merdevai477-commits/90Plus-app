/**
 * تحكم في حجم مربعات المسابقات (صف Rank).
 *
 * ── الطريقة الأسهل ──
 * COMP_CARD_SCALE        → يكبّر/يصغّر العرض والطول مع بعض
 *
 * ── تحكم منفصل ──
 * COMP_CARD_WIDTH_SCALE  → العرض (أعرض / أضيق)
 * COMP_CARD_HEIGHT_SCALE → الطول (أطول لتحت / أقصر لفوق)
 *   (لو سيبتيها null بتاخد قيمة COMP_CARD_SCALE)
 *
 * ── قيم ثابتة بالبكسل (اختياري) ──
 * COMP_CARD_WIDTH_OVERRIDE / COMP_CARD_HEIGHT_OVERRIDE
 *
 * ── مساحة الصورة من فوق (اختياري) ──
 * COMP_CARD_PADDING_TOP_OVERRIDE → null = تلقائي حسب الطول
 */

/** مقياس عام — العرض والطول مع بعض */
export const COMP_CARD_SCALE = 1;

/** عرض لوحده — مثال: 1.1 أعرض | 0.9 أضيق | null = يستخدم SCALE */
export const COMP_CARD_WIDTH_SCALE: number | null = null;

/** طول لوحده — مثال: 1.2 أطول لتحت | 0.85 أقصر لفوق | null = يستخدم SCALE */
export const COMP_CARD_HEIGHT_SCALE: number | null = null;

/** قيم ثابتة بالبكسل (أولوية أعلى من SCALE) */
export const COMP_CARD_WIDTH_OVERRIDE: number | null = null;
export const COMP_CARD_HEIGHT_OVERRIDE: number | null = null;

/** مسافة بداية النص من فوق — null = تتناسب تلقائيًا مع الطول */
export const COMP_CARD_PADDING_TOP_OVERRIDE: number | null = null;

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

const ART_AREA_RATIO = FIGMA.paddingTop / FIGMA.height;

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

export function getCompCardMetrics(
  scale = COMP_CARD_SCALE,
  widthScale = COMP_CARD_WIDTH_SCALE,
  heightScale = COMP_CARD_HEIGHT_SCALE,
): CompCardMetrics {
  const wScale = widthScale ?? scale;
  const hScale = heightScale ?? scale;

  const width = COMP_CARD_WIDTH_OVERRIDE ?? round(FIGMA.width * wScale);
  const height = COMP_CARD_HEIGHT_OVERRIDE ?? round(FIGMA.height * hScale);
  const paddingTop =
    COMP_CARD_PADDING_TOP_OVERRIDE ?? round(height * ART_AREA_RATIO);

  return {
    width,
    height,
    borderRadius: round(FIGMA.borderRadius * wScale),
    paddingTop,
    paddingBottom: round(FIGMA.paddingBottom * hScale),
    paddingHorizontal: round(FIGMA.paddingHorizontal * wScale),
    contentGap: round(FIGMA.contentGap * wScale),
    textGap: round(FIGMA.textGap * wScale),
    titleGap: round(FIGMA.titleGap * wScale),
    titleFontSize: round(FIGMA.titleFontSize * wScale),
    titleLineHeight: round(FIGMA.titleLineHeight * wScale),
    titleIconSize: round(FIGMA.titleIconSize * wScale),
    subFontSize: round(FIGMA.subFontSize * wScale),
    subLineHeight: round(FIGMA.subLineHeight * wScale),
    ctaWidth: round(FIGMA.ctaWidth * wScale),
    ctaPaddingV: round(FIGMA.ctaPaddingV * wScale),
    ctaPaddingH: round(FIGMA.ctaPaddingH * wScale),
    ctaFontSize: round(FIGMA.ctaFontSize * wScale),
    ctaIconSize: round(FIGMA.ctaIconSize * wScale),
    ctaRadius: round(FIGMA.ctaRadius * wScale),
    ctaGap: round(FIGMA.ctaGap * wScale),
  };
}

export const COMP_CARD_WIDTH = getCompCardMetrics().width;
export const COMP_CARD_HEIGHT = getCompCardMetrics().height;
