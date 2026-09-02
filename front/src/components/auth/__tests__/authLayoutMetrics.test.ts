/**
 * PRE-LOGIN LAYOUT — the arithmetic, on every iPhone the app supports.
 * =============================================================================
 *
 * The reported bug is "the screens before login are not responsive on iPhone",
 * and the cause was arithmetic rather than styling: the hero scaled with screen
 * width while the panel's sizes and its 55/48/42/41pt gaps stayed in raw Figma
 * units, so the two disagreed about how big the phone was. The disagreement is
 * invisible at 448pt (the design width) and gets worse in both directions.
 *
 * These run the real `getAuthLayoutMetrics` against real device sizes, so a
 * regression is caught at the size it actually breaks — not just at whatever
 * simulator someone happened to open. The last block is the important one: it
 * measures the whole composed panel and asserts the Sign Up button is reachable
 * on the SMALLEST supported iPhone.
 */

import {
  AUTH_MAX_CONTENT_WIDTH,
  AUTH_SCALE_MAX,
  AUTH_SCALE_MIN,
  FIGMA_AUTH_FRAME,
  getAuthLayoutMetrics,
} from '../authLayoutMetrics';

/** Points, portrait. Every iPhone form factor the app ships to. */
const IPHONES = [
  { name: 'iPhone SE (1st gen)', width: 320, height: 568 },
  { name: 'iPhone SE (2nd/3rd gen) / 8', width: 375, height: 667 },
  { name: 'iPhone 8 Plus', width: 414, height: 736 },
  { name: 'iPhone X / XS / 11 Pro / 12 mini', width: 375, height: 812 },
  { name: 'iPhone 13 mini', width: 375, height: 812 },
  { name: 'iPhone XR / 11', width: 414, height: 896 },
  { name: 'iPhone 12 / 13 / 14', width: 390, height: 844 },
  { name: 'iPhone 14 Pro (Dynamic Island)', width: 393, height: 852 },
  { name: 'iPhone 15 / 16', width: 393, height: 852 },
  { name: 'iPhone 16 Pro', width: 402, height: 874 },
  { name: 'iPhone 14 Plus / 15 Plus', width: 428, height: 926 },
  { name: 'iPhone 16 Pro Max', width: 440, height: 956 },
] as const;

const EXTREMES = [
  { name: 'iPad 10.9 portrait', width: 820, height: 1180 },
  { name: 'iPad Pro 12.9 landscape', width: 1366, height: 1024 },
  { name: 'iPhone 16 Pro landscape', width: 874, height: 402 },
  { name: 'very narrow split view', width: 280, height: 700 },
] as const;

const ALL = [...IPHONES, ...EXTREMES];

describe.each(ALL)('$name ($width x $height)', ({ width, height }) => {
  const m = getAuthLayoutMetrics(width, height);

  it('keeps the scale inside its clamp', () => {
    expect(m.scale).toBeGreaterThanOrEqual(AUTH_SCALE_MIN);
    expect(m.scale).toBeLessThanOrEqual(AUTH_SCALE_MAX);
  });

  it('never lays out wider than the window', () => {
    expect(m.contentWidth).toBeLessThanOrEqual(width);
    expect(m.contentWidth).toBeLessThanOrEqual(AUTH_MAX_CONTENT_WIDTH);
  });

  it('keeps the panel inside the column — no horizontal overflow', () => {
    // The panel is inset on both sides and then padded on both sides; its
    // content box has to be a positive width or the form clips off-screen.
    const panelWidth = m.contentWidth - m.horizontalInset * 2;
    const panelContentWidth = panelWidth - m.panelPaddingX * 2;

    expect(panelWidth).toBeGreaterThan(0);
    expect(panelContentWidth).toBeGreaterThan(0);
    expect(panelWidth).toBeLessThanOrEqual(m.contentWidth);
  });

  it('gives the hero a sane share of the screen', () => {
    expect(m.heroHeight).toBeGreaterThan(0);
    // Never more than a bit under half the screen — past that the form starts
    // so far down that nothing but artwork is visible on load.
    expect(m.heroHeight / height).toBeLessThanOrEqual(0.45);
    // …and never so short it stops reading as artwork.
    expect(m.heroHeight / height).toBeGreaterThanOrEqual(0.2);
  });

  it('starts the panel below the top of the screen', () => {
    const panelTop = m.heroHeight - m.panelOverlap + m.panelDropOffset;
    expect(panelTop).toBeGreaterThan(0);
    expect(panelTop).toBeLessThan(height);
  });

  it('rounds spacing to whole points', () => {
    expect(Number.isInteger(m.s(55))).toBe(true);
    expect(Number.isInteger(m.f(26))).toBe(true);
  });
});

describe('the scale is one number, not two systems', () => {
  it('is exactly 1 at the design width', () => {
    const m = getAuthLayoutMetrics(FIGMA_AUTH_FRAME.width, FIGMA_AUTH_FRAME.height);
    expect(m.scale).toBeCloseTo(1, 5);
    expect(m.s(56)).toBe(56);
    expect(m.f(26)).toBe(26);
  });

  it('shrinks together on a small phone', () => {
    const se = getAuthLayoutMetrics(320, 568);
    expect(se.scale).toBeLessThan(1);
    // Spacing shrinks; type shrinks more gently so it stays readable.
    expect(se.s(55)).toBeLessThan(55);
    expect(se.f(26)).toBeLessThan(26);
    expect(se.f(26) / 26).toBeGreaterThan(se.s(26) / 26);
  });

  it('stops growing on a tablet instead of inflating a phone layout', () => {
    const ipad = getAuthLayoutMetrics(820, 1180);
    expect(ipad.scale).toBe(AUTH_SCALE_MAX);
    expect(ipad.contentWidth).toBe(AUTH_MAX_CONTENT_WIDTH);
    // The old, unclamped formula: 820/448 = 1.83 → a 716pt-tall hero.
    expect(ipad.heroHeight).toBeLessThan((391 / 448) * 820);
  });

  it('is monotonic across widths — no size gets a smaller layout than a smaller phone', () => {
    const widths = [320, 360, 375, 390, 393, 402, 414, 428, 440];
    const scales = widths.map((w) => getAuthLayoutMetrics(w, w * 2.16).scale);

    for (let i = 1; i < scales.length; i += 1) {
      expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1]);
    }
  });
});

/**
 * THE ONE THAT MATTERS: is the Sign Up button reachable?
 *
 * Composes the panel out of the same design units the components use, so this
 * measures the real screen rather than a guess. It is a scroll view, so the
 * button does not have to be above the fold — but it must be within a short,
 * ordinary scroll on the smallest phone, and it must not need scrolling at all
 * on a large one.
 */
function panelHeights(width: number, height: number) {
  const m = getAuthLayoutMetrics(width, height);
  const { s } = m;

  const field = Math.max(s(62), 48);
  const header = m.f(26) * 1.3 + s(6) + m.f(19) * 1.3 + s(48);
  const fields = field * 3 + s(16) * 2;
  const terms = Math.max(s(42), 44);
  const toButton =
    s(40) + // panel padding top
    header +
    fields +
    s(18) + // form gap
    terms +
    s(55); // main gap, then the Sign Up button

  const button = Math.max(s(56), 44);
  const panelTop = m.heroHeight - m.panelOverlap + m.panelDropOffset;

  return {
    metrics: m,
    /** y of the bottom of the Sign Up button, from the top of the window. */
    signUpBottom: panelTop + toButton + button,
    button,
  };
}

describe('the Sign Up button', () => {
  it.each(IPHONES)('is reachable on $name', ({ width, height }) => {
    const { signUpBottom } = panelHeights(width, height);

    // "Reachable" = within one screen of scrolling. Anything beyond that and
    // the primary action of the screen is effectively hidden.
    expect(signUpBottom).toBeLessThan(height * 2);
  });

  it('is fully on screen without scrolling on a large iPhone', () => {
    // iPhone 16 Pro Max.
    const { signUpBottom } = panelHeights(440, 956);
    expect(signUpBottom).toBeLessThanOrEqual(956);
  });

  it('needs less scrolling than it used to on the smallest iPhone', () => {
    // The regression guard. Under the old layout the hero scaled with width
    // while the panel stayed at raw Figma units; reproduced here.
    const height = 568;
    const width = 320;

    const oldHero = (391 / 448) * width;
    const oldScale = width / 448;
    const oldPanelTop = oldHero - 27 * oldScale + 48 * oldScale;
    const oldToButton = 40 + (26 * 1.3 + 6 + 19 * 1.3 + 48) + (62 * 3 + 32) + 18 + 42 + 55;
    const oldSignUpBottom = oldPanelTop + oldToButton + 56;

    const { signUpBottom } = panelHeights(width, height);

    expect(signUpBottom).toBeLessThan(oldSignUpBottom);
  });

  it('keeps a tappable button at the smallest scale', () => {
    const { button } = panelHeights(320, 568);
    expect(button).toBeGreaterThanOrEqual(44);
  });
});
