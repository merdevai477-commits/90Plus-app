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

/** Nudge panel down in "steps" (1 step = 16px on Figma frame). */
export const PANEL_DROP_STEPS = 3;
export const PANEL_STEP_PX = 16;

export function getAuthLayoutMetrics(screenWidth: number, screenHeight: number) {
  const scale = screenWidth / FIGMA_AUTH_FRAME.width;
  const heroHeight = FIGMA_AUTH_FRAME.heroHeight * scale;
  const panelOverlap = FIGMA_PANEL_OVERLAP * scale;
  const horizontalInset = FIGMA_AUTH_FRAME.horizontalInset * scale;
  const panelPaddingX = FIGMA_AUTH_FRAME.panelPaddingX * scale;
  const panelDropOffset = PANEL_DROP_STEPS * PANEL_STEP_PX * scale;

  return {
    scale,
    heroHeight,
    panelOverlap,
    panelDropOffset,
    horizontalInset,
    panelPaddingX,
  };
}
