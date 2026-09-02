import React from 'react';
import { View, StyleSheet } from 'react-native';

/** Figma panel body spacing (node 1015:3722 SwiftUI export). */
export const AUTH_PANEL_GAP = {
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
  return <View style={styles.fields}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 6,
  },
  main: {
    gap: AUTH_PANEL_GAP.main,
  },
  formSection: {
    gap: AUTH_PANEL_GAP.form,
  },
  fields: {
    gap: AUTH_PANEL_GAP.fields,
  },
  actionSection: {
    gap: AUTH_PANEL_GAP.action,
  },
  ctaSection: {
    gap: AUTH_PANEL_GAP.cta,
  },
  socialSection: {
    gap: AUTH_PANEL_GAP.social,
  },
});
