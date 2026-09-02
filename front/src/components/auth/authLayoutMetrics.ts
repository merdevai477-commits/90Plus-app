/** Figma sign-up screen metrics (node 1015:3722, frame 448×1154). */
export const FIGMA_AUTH_FRAME = {
  width: 448,
  height: 1154,
  heroHeight: 391,
  heroOffsetY: -381.5,
  panelWidth: 408,
  panelHeight: 747,
  panelOffsetY: 160.5,
  panelContentWidth: 368,
  panelHeaderWidth: 314,
  horizontalInset: 20,
  panelPaddingX: 20,
} as const;

/** Hero bottom (391) minus panel top (364) on the Figma frame. */
export const FIGMA_PANEL_OVERLAP = 27;

export function getAuthLayoutMetrics(screenWidth: number, screenHeight: number) {
  const scale = screenWidth / FIGMA_AUTH_FRAME.width;
  const heroHeight = FIGMA_AUTH_FRAME.heroHeight * scale;
  const panelOverlap = FIGMA_PANEL_OVERLAP * scale;
  const horizontalInset = FIGMA_AUTH_FRAME.horizontalInset * scale;
  const panelPaddingX = FIGMA_AUTH_FRAME.panelPaddingX * scale;

  const frameCenterY = screenHeight / 2;
  const heroCenterY = frameCenterY + FIGMA_AUTH_FRAME.heroOffsetY * (screenHeight / FIGMA_AUTH_FRAME.height);
  const heroBottom = heroCenterY + heroHeight / 2;
  const panelCenterY = frameCenterY + FIGMA_AUTH_FRAME.panelOffsetY * (screenHeight / FIGMA_AUTH_FRAME.height);
  const panelTop = panelCenterY - (FIGMA_AUTH_FRAME.panelHeight * scale) / 2;
  const overlapFromGeometry = Math.max(heroBottom - panelTop, panelOverlap);

  return {
    scale,
    heroHeight,
    panelOverlap: overlapFromGeometry,
    horizontalInset,
    panelPaddingX,
  };
}
