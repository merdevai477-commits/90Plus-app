/**
 * Global font setup.
 *
 * Chooses a default font family for every `<Text>` and `<TextInput>` in the
 * app based on the active language:
 *   - `ar` → Cairo_400Regular
 *   - everything else → Poppins_400Regular
 *
 * Components that set an explicit `fontFamily` (e.g. `'monospace'` for code
 * blocks) still win, because inline style overrides the merged default.
 *
 * Implementation detail: we mutate `Text.defaultProps` / `TextInput.defaultProps`
 * once and subscribe to the Zustand language store so a runtime language switch
 * updates the default immediately. Already-mounted components re-read
 * `defaultProps` on their next render, which happens on every screen
 * navigation or state change after a language toggle.
 */

import { Text, TextInput } from 'react-native';
import { useLanguageStore } from '../src/i18n/store';

// Registered via `expo-font` / `useFonts` in `app/_layout.tsx`.
export const FONT_LATIN = 'Inter_400Regular';
export const FONT_ARABIC = 'Cairo_400Regular';

type WithDefaultProps<P> = P & {
    defaultProps?: { style?: unknown; allowFontScaling?: boolean };
};

const components: WithDefaultProps<unknown>[] = [
    Text as unknown as WithDefaultProps<unknown>,
    TextInput as unknown as WithDefaultProps<unknown>,
];

/** Returns the font family for the given language code. */
export function getFontFamilyForLanguage(lang: string): string {
    return lang === 'ar' ? FONT_ARABIC : FONT_LATIN;
}

/**
 * Apply the correct default font for the current language to Text / TextInput.
 * Subsequent calls replace the previously injected default so switching
 * languages doesn't leave stale styles around.
 */
function applyFontForLanguage(lang: string): void {
    const fontFamily = getFontFamilyForLanguage(lang);

    components.forEach((component) => {
        const existing = component.defaultProps ?? {};
        // Strip any previously-injected default so we never stack fontFamily
        // overrides on top of each other.
        const preservedStyle = Array.isArray(existing.style)
            ? existing.style.filter(
                  (s) =>
                      !(
                          s &&
                          typeof s === 'object' &&
                          '__appDefaultFont' in (s as Record<string, unknown>)
                      ),
              )
            : existing.style;

        component.defaultProps = {
            ...existing,
            style: [
                { fontFamily, __appDefaultFont: true } as unknown as object,
                preservedStyle,
            ],
        };
    });
}

let installed = false;
let unsubscribe: (() => void) | null = null;

/**
 * Install the language-aware default font on Text / TextInput and subscribe
 * to language changes. Safe to call multiple times — subsequent calls are a
 * no-op.
 */
export function applyGlobalFont(): void {
    if (installed) return;
    installed = true;

    const currentLanguage = useLanguageStore.getState().language;
    applyFontForLanguage(currentLanguage);

    unsubscribe = useLanguageStore.subscribe((state, prev) => {
        if (state.language !== prev.language) {
            applyFontForLanguage(state.language);
        }
    });
}

/** Test-only reset hook. Not used in production code. */
export function __resetGlobalFontForTests(): void {
    unsubscribe?.();
    unsubscribe = null;
    installed = false;
    components.forEach((component) => {
        component.defaultProps = {};
    });
}

// ─── React hook for explicit font-family selection ───────────────────────────
// Use from any component to get the current language-aware font family, with
// optional weight. Example:
//
//   const font = useAppFont(700);        // → 'Poppins_700Bold' or 'Cairo_700Bold'
//   <Text style={{ fontFamily: font }}>{title}</Text>

import { useMemo } from 'react';

export type FontWeight = 400 | 500 | 600 | 700 | 800;

const WEIGHT_SUFFIX: Record<FontWeight, string> = {
    400: 'Regular',
    500: 'Medium',
    600: 'SemiBold',
    700: 'Bold',
    800: 'ExtraBold',
};

/** Returns the `fontFamily` for a given weight in the active language. */
export function getAppFont(weight: FontWeight = 400, language?: string): string {
    const lang = language ?? useLanguageStore.getState().language;
    // Arabic → Cairo, everything else → Inter
    const family = lang === 'ar' ? 'Cairo' : 'Inter';
    return `${family}_${weight}${WEIGHT_SUFFIX[weight]}`;
}

/** Hook form — re-renders the caller when the language changes. */
export function useAppFont(weight: FontWeight = 400): string {
    const language = useLanguageStore((s) => s.language);
    return useMemo(() => getAppFont(weight, language), [weight, language]);
}

/**
 * Screen-level hook: declares that a screen is using the app's font pair
 * (Poppins for Latin, Cairo for Arabic) and re-renders the screen when the
 * language switches so the default font swap is reflected immediately.
 *
 * Drop this at the top of any screen:
 *
 *   export default function MyScreen() {
 *     useScreenFont();
 *     ...
 *   }
 */
export function useScreenFont(): void {
    // Subscribing to `language` forces the screen to re-render whenever the
    // user toggles between en / ar, which lets the Text.defaultProps font
    // change (Poppins ↔ Cairo) take effect on mounted screens right away.
    useLanguageStore((s) => s.language);
}
