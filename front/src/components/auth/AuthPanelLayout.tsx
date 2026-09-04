import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { useAuthScale } from './authLayoutMetrics';

/**
 * Figma panel body spacing (node 1015:3722 SwiftUI export), in DESIGN units.
 *
 * These are large — 55pt between the form and the actions, 48pt under the
 * header — and they were being applied raw at every screen size. On the 448 ×
 * 1154 frame that is proportionate; on a 375 × 667 iPhone SE it is a fifth of
 * the screen spent on two gaps, which is what drove the Sign Up button below
 * the fold. They go through `s()` now, like every other measurement here.
 */
export const AUTH_PANEL_GAP = {
  header: 48,
  headerInner: 6,
  main: 55,
  form: 18,
  fields: 16,
  terms: 8,
  action: 42,
  cta: 41,
  social: 14,
} as const;

type Props = {
  header: React.ReactNode;
  form: React.ReactNode;
  cta: React.ReactNode;
  social: React.ReactNode;
};

/**
 * Mirrors the Figma panel ZStack layout:
 * header → VStack(55) { form VStack(18), action VStack(42) { cta VStack(41), social VStack(14) } }
 */
export function AuthPanelLayout({ header, form, cta, social }: Props) {
  const styles = useAuthPanelStyles();

  return (
    <View style={styles.root}>
      <View style={styles.header}>{header}</View>

      <View style={styles.main}>
        <View style={styles.formSection}>{form}</View>

        <View style={styles.actionSection}>
          <View style={styles.ctaSection}>{cta}</View>
          <View style={styles.socialSection}>{social}</View>
        </View>
      </View>
    </View>
  );
}

export function AuthFormFields({ children }: { children: React.ReactNode }) {
  const styles = useAuthPanelStyles();
  return <View style={styles.fields}>{children}</View>;
}

function useAuthPanelStyles() {
  const { s, scale } = useAuthScale();

  return useMemo(
    () =>
      StyleSheet.create({
        root: {
          width: '100%',
        },
        header: {
          alignItems: 'center',
          marginBottom: s(AUTH_PANEL_GAP.header),
          gap: s(AUTH_PANEL_GAP.headerInner),
        },
        main: {
          gap: s(AUTH_PANEL_GAP.main),
        },
        formSection: {
          gap: s(AUTH_PANEL_GAP.form),
        },
        fields: {
          gap: s(AUTH_PANEL_GAP.fields),
        },
        actionSection: {
          gap: s(AUTH_PANEL_GAP.action),
        },
        ctaSection: {
          gap: s(AUTH_PANEL_GAP.cta),
        },
        socialSection: {
          gap: s(AUTH_PANEL_GAP.social),
        },
      }),
    // `s` is rebuilt every render; `scale` is the value that actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale],
  );
}
