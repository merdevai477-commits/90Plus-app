import React from 'react';
import { View, StyleSheet } from 'react-native';

/** Figma panel body spacing — signup 1015:3722, login 1017:3880. */
export const AUTH_PANEL_GAP = {
  /** Signup: 3 fields → larger gap before CTA. Login: 2 fields → 42. */
  mainSignup: 55,
  mainLogin: 42,
  form: 18,
  fields: 16,
  terms: 8,
  action: 42,
  cta: 41,
  social: 14,
  headerSignup: 6,
  headerLogin: 8,
} as const;

type Props = {
  header: React.ReactNode;
  form: React.ReactNode;
  cta: React.ReactNode;
  social: React.ReactNode;
  /** Login Figma uses tighter main gap (42) than signup (55). */
  variant?: 'signup' | 'login';
};

/**
 * Mirrors the Figma panel layout:
 * header → VStack(main) { form VStack(18), action VStack(42) { cta VStack(41), social VStack(14) } }
 */
export function AuthPanelLayout({
  header,
  form,
  cta,
  social,
  variant = 'signup',
}: Props) {
  const isLogin = variant === 'login';

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.header,
          { gap: isLogin ? AUTH_PANEL_GAP.headerLogin : AUTH_PANEL_GAP.headerSignup },
        ]}
      >
        {header}
      </View>

      <View
        style={[
          styles.main,
          { gap: isLogin ? AUTH_PANEL_GAP.mainLogin : AUTH_PANEL_GAP.mainSignup },
        ]}
      >
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
    marginBottom: 48,
  },
  main: {},
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
