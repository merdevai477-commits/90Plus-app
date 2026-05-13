/**
 * 90Plus — Unified UI System
 *
 * Single source of truth for:
 *  - App background (re-exports BG_BASE from tokens.ts)
 *  - Glass / blur surface helpers (LiquidGlass on iOS 26+, BlurView fallback)
 *  - Shared gradient presets
 *
 * Usage:
 *   import { APP_BG, GlassWrapper, glassProps } from '@/constants/ui';
 *
 *   // Background — use on every screen root View
 *   <View style={{ flex: 1, backgroundColor: APP_BG }}>
 *
 *   // Glass surface (auto-selects LiquidGlass or BlurView)
 *   <GlassWrapper {...glassProps.card} style={styles.card} />
 */

import { Platform } from 'react-native';
import { isLiquidGlassSupported, LiquidGlassView } from '@/utils/liquidGlassSafe';
import { BlurView } from 'expo-blur';
import { BG_BASE, BG_MID, BG_SURFACE, PURPLE_PRIMARY, PURPLE_DARK } from './tokens';

// ─── App Background ───────────────────────────────────────────────────────────

/** Canonical app background — deep space purple-black (#05010D). */
export const APP_BG = BG_BASE;

/** Slightly lighter surface for cards / sheets on top of APP_BG. */
export const SURFACE_BG = 'rgba(14,8,28,0.98)' as const;

// ─── Glass Component ──────────────────────────────────────────────────────────

/**
 * Drop-in glass component.
 * iOS 26+ → LiquidGlassView  |  everything else → BlurView
 *
 * @example
 * <GlassWrapper {...glassProps.card} style={styles.card} />
 */
export const GlassWrapper: typeof LiquidGlassView | typeof BlurView =
  isLiquidGlassSupported ? LiquidGlassView : BlurView;

// ─── Glass Prop Presets ───────────────────────────────────────────────────────

type LiquidPreset = {
  effect: 'clear' | 'regular' | 'prominent';
  tint?: string;
  interactive?: boolean;
};

type BlurPreset = {
  intensity: number;
  tint: 'dark' | 'light' | 'default' | 'extraLight' |
        'systemUltraThinMaterial' | 'systemThinMaterial' |
        'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial' |
        'systemUltraThinMaterialDark' | 'systemThinMaterialDark' |
        'systemMaterialDark' | 'systemThickMaterialDark' | 'systemChromeMaterialDark';
};

/**
 * Ready-made glass prop presets — spread directly onto <GlassWrapper>.
 *
 * @example
 * <GlassWrapper {...glassProps.nav} style={styles.bottomNav} />
 * <GlassWrapper {...glassProps.modal} style={styles.sheet} />
 */
export const glassProps: Record<string, LiquidPreset | BlurPreset> =
  isLiquidGlassSupported
    ? {
        /** Bottom navigation bar */
        nav:     { effect: 'clear',     tint: 'rgba(5,1,13,0.05)',  interactive: true },
        /** Floating header */
        header:  { effect: 'clear',     tint: 'rgba(5,1,13,0.10)' },
        /** Cards and list rows */
        card:    { effect: 'clear',     tint: 'rgba(20,15,30,0.65)' },
        /** Modals and bottom sheets */
        modal:   { effect: 'regular',   tint: 'rgba(15,5,25,0.99)' },
        /** Prominent overlay (context menus, alerts) */
        overlay: { effect: 'prominent', tint: 'rgba(10,3,20,0.99)' },
        /** Tab / filter chips */
        chip:    { effect: 'clear',     tint: 'rgba(20,15,30,0.65)' },
      }
    : {
        nav:     { intensity: Platform.OS === 'android' ? 100 : 20,  tint: 'dark' },
        header:  { intensity: Platform.OS === 'android' ? 100 : 15,  tint: 'dark' },
        card:    { intensity: Platform.OS === 'android' ? 100 : 24,  tint: 'dark' },
        modal:   { intensity: Platform.OS === 'android' ? 100 : 30,  tint: 'dark' },
        overlay: { intensity: Platform.OS === 'android' ? 100 : 60,  tint: 'dark' },
        chip:    { intensity: Platform.OS === 'android' ? 100 : 25,  tint: 'dark' },
      };

// ─── Gradient Presets ─────────────────────────────────────────────────────────

/**
 * Shared gradient color arrays for expo-linear-gradient.
 *
 * @example
 * <LinearGradient colors={AppGradients.screenBg} style={StyleSheet.absoluteFill} />
 */
export const AppGradients = {
  /** Full-screen background gradient (same on every tab) */
  screenBg:     [BG_BASE, BG_MID, BG_SURFACE, BG_BASE] as const,
  /** Subtle purple ambient — top of screen */
  ambientTop:   ['rgba(76,29,149,0.35)', 'transparent'] as const,
  /** Subtle purple ambient — right edge */
  ambientRight: ['rgba(124,58,237,0.25)', 'transparent'] as const,
  /** Fade to APP_BG from left (hero images) */
  fadeLeft:     [BG_BASE, BG_BASE, 'rgba(5,1,13,0.9)', 'transparent'] as const,
  /** Fade to APP_BG from bottom (hero images) */
  fadeBottom:   ['transparent', 'rgba(5,1,13,0.55)', BG_BASE] as const,
  /** Purple CTA button */
  purpleCTA:    [PURPLE_PRIMARY, PURPLE_DARK] as const,
  /** Purple glow card */
  purpleCard:   ['rgba(168,85,247,0.2)', 'rgba(124,58,237,0.1)'] as const,
} as const;

// ─── Accent Colors (re-exported for convenience) ──────────────────────────────

export const ACCENT        = '#A855F7' as const;
export const ACCENT_DARK   = PURPLE_PRIMARY;
export const ACCENT_DEEPER = PURPLE_DARK;
export const ACCENT_SOFT   = '#D8B4FE' as const;
export const ACCENT_MUTED  = 'rgba(168,85,247,0.3)' as const;
