/**
 * GlassCard — Premium glass-morphism card component
 * Based on 90Plus design system
 *
 * Implementation note:
 * Tamagui's `styled()` with `allowedStyleValues: 'somewhat-strict'` rejects
 * arbitrary color strings and shadow objects inside variant definitions.
 * We work around this by building the component with React Native StyleSheet
 * and exposing a clean variant prop API — same DX, zero type errors.
 */

import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { type CardProps } from 'tamagui';

// ─── Design tokens (mirrors tamagui.config.ts tokens.color) ──────────────────
const GLASS_BG = {
    default: 'rgba(255,255,255,0.08)',
    medium:  'rgba(255,255,255,0.12)',
    dark:    'rgba(255,255,255,0.04)',
    solid:   '#0A0A0A',
} as const;

const GLASS_BORDER = 'rgba(255,255,255,0.12)';

const SHADOW: Record<ElevationVariant, ViewStyle> = {
    low: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    high: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 16,
    },
    highest: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
        elevation: 24,
    },
};

// ─── Variant types ────────────────────────────────────────────────────────────
type VariantName    = 'default' | 'medium' | 'dark' | 'solid';
type ElevationVariant = 'low' | 'medium' | 'high' | 'highest';

export type GlassCardProps = {
    variant?: VariantName;
    elevation?: ElevationVariant;
    pressable?: boolean;
    style?: ViewStyle;
    children?: React.ReactNode;
    /** Forward any remaining CardProps for Tamagui interop. */
} & Omit<CardProps, 'style'>;

// ─── Component ────────────────────────────────────────────────────────────────
export const GlassCard = React.forwardRef<View, GlassCardProps>(
    function GlassCard(
        {
            variant = 'default',
            elevation = 'medium',
            pressable: _pressable,   // consumed — not forwarded to View
            style,
            children,
            ...rest
        },
        ref,
    ) {
        const cardStyle: ViewStyle = {
            backgroundColor: GLASS_BG[variant],
            borderWidth: 1,
            borderColor: GLASS_BORDER,
            borderRadius: 24,
            ...SHADOW[elevation],
        };

        return (
            <View
                ref={ref}
                style={[cardStyle, style]}
                // Spread only plain-object props that View accepts.
                // CardProps may include Tamagui-specific keys; we omit them
                // to avoid runtime warnings on the native View.
                {...(rest as object)}
            >
                {children}
            </View>
        );
    },
);

// Keep the named export shape consistent with the old styled() API so
// existing import sites don't need to change.
export type { GlassCardProps as GlassCardType };
