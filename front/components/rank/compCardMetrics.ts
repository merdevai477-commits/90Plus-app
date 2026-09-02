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

/** عرض لوحده — مثال: 1.1 أعرض | 0.9 أضيق | null = يملأ نصف الشاشة تلقائيًا */
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

/** مسافات شبكة 2×2 (Figma) */
export const COMP_GRID_PADDING = 14;
export const COMP_GRID_COLUMN_GAP = 12;
export const COMP_GRID_ROW_GAP = 16;

const round = (value: number) => Math.round(value);

function scaleUi(wScale: number) {
  return {
    borderRadius: round(FIGMA.borderRadius * wScale),
    paddingBottom: round(FIGMA.paddingBottom * wScale),
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
    paddingTop,
    paddingBottom: round(FIGMA.paddingBottom * hScale),
    ...scaleUi(wScale),
  };
}

/** يحسب المقاسات من عرض الشبكة (نصف الشاشة) — للعرض 2×2 زي Figma */
export function getCompCardMetricsForLayout(cardWidth: number): CompCardMetrics {
  const baseWidth = COMP_CARD_WIDTH_OVERRIDE ?? cardWidth;
  const widthRatio = baseWidth / FIGMA.width;
  const heightFactor =
    (COMP_CARD_HEIGHT_SCALE ?? COMP_CARD_SCALE) / (COMP_CARD_WIDTH_SCALE ?? COMP_CARD_SCALE);
  const height =
    COMP_CARD_HEIGHT_OVERRIDE ?? round(FIGMA.height * widthRatio * heightFactor);
  const paddingTop =
    COMP_CARD_PADDING_TOP_OVERRIDE ?? round(height * ART_AREA_RATIO);

  return {
    width: baseWidth,
    height,
    paddingTop,
    paddingBottom: round(FIGMA.paddingBottom * widthRatio * heightFactor),
    ...scaleUi(widthRatio),
  };
}

export function getCompGridCardWidth(screenWidth: number): number {
  return Math.floor(
    (screenWidth - COMP_GRID_PADDING * 2 - COMP_GRID_COLUMN_GAP) / 2,
  );
}

export const COMP_CARD_WIDTH = getCompCardMetrics().width;
export const COMP_CARD_HEIGHT = getCompCardMetrics().height;
