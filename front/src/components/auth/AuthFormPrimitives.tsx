import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { LEGAL_URLS, openLegalUrl } from '@/config/legal.config';
import {
  AUTH_ACCENT,
  AUTH_BUTTON_SOLID,
  AUTH_CHECKBOX_BG,
  AUTH_CHECKBOX_BORDER,
  AUTH_DIVIDER_LINE,
  AUTH_DIVIDER_TEXT,
  AUTH_SOCIAL_BG,
  AUTH_SOCIAL_BORDER,
  AUTH_TEXT_MUTED,
  AUTH_TEXT_SUBTITLE,
} from './AuthTokens';
import { TEXT_PRIMARY } from '../../../constants/tokens';
import { useAuthScale } from './authLayoutMetrics';

const googleIcon = require('../../../assets/images/auth/icon-google.svg');
const appleIcon = require('../../../assets/images/auth/icon-apple.svg');

const SOCIAL_BTN_HEIGHT = 54;
const SOCIAL_BTN_RADIUS = 12;
const SOCIAL_BTN_PADDING_H = 24;
const SOCIAL_BTN_PADDING_V = 10;
const SOCIAL_ICON_SIZE = 24;
const SOCIAL_ROW_GAP = 16;

function AuthSocialButton({
  onPress,
  disabled,
  loading,
  icon,
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: number;
}) {
  const styles = useAuthPrimitiveStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.socialBtnOuter, (disabled || loading) && { opacity: 0.6 }]}
    >
      <View style={styles.socialBtnInner}>
        {loading ? (
          <ActivityIndicator color={TEXT_PRIMARY} size="small" />
        ) : (
          <Image source={icon} style={styles.socialIcon} contentFit="contain" />
        )}
      </View>
    </TouchableOpacity>
  );
}

export function AuthPanelHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const styles = useAuthPrimitiveStyles();

  return (
    <>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelSubtitle}>{subtitle}</Text>
    </>
  );
}

export function AuthPrimaryButton({
  label,
  loading,
  loadingLabel,
  onPress,
  disabled,
  style,
}: {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const styles = useAuthPrimitiveStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.primaryBtn,
        (disabled || loading) && { opacity: 0.6 },
        style,
      ]}
    >
      <Text style={styles.primaryTxt}>
        {loading ? (loadingLabel ?? label) : label}
      </Text>
    </TouchableOpacity>
  );
}

export function AuthDivider({ label }: { label: string }) {
  const styles = useAuthPrimitiveStyles();

  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerTxt}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function AuthSocialButtons({
  onGoogle,
  onApple,
  loading,
  googleLoading,
  appleLoading,
}: {
  onGoogle: () => void;
  onApple: () => void;
  loading?: boolean;
  googleLoading?: boolean;
  appleLoading?: boolean;
}) {
  const styles = useAuthPrimitiveStyles();

  return (
    <View style={styles.socialRow}>
      <AuthSocialButton
        onPress={onGoogle}
        disabled={loading}
        loading={googleLoading}
        icon={googleIcon}
      />
      <AuthSocialButton
        onPress={onApple}
        disabled={loading}
        loading={appleLoading}
        icon={appleIcon}
      />
    </View>
  );
}

export function AuthFooterLink({
  muted,
  link,
  onPress,
  isRTL,
}: {
  muted: string;
  link: string;
  onPress: () => void;
  isRTL?: boolean;
}) {
  const styles = useAuthPrimitiveStyles();

  return (
    <View style={[styles.footerRow, isRTL && styles.footerRowRtl]}>
      {isRTL ? (
        <>
          <Pressable onPress={onPress} hitSlop={8}>
            <Text style={styles.footerLink}>{link}</Text>
          </Pressable>
          <Text style={styles.footerMuted}>{muted}</Text>
        </>
      ) : (
        <>
          <Text style={styles.footerMuted}>{muted} </Text>
          <Pressable onPress={onPress} hitSlop={8}>
            <Text style={styles.footerLink}>{link}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

type TermsCopy = {
  registerAgreementPrefix: string;
  registerTermsLink: string;
  registerPrivacyLink: string;
  registerAgreementAfterLinks: string;
};

const TERMS_FONT_SIZE = 16;
const TERMS_LINE_HEIGHT = 20;
const TERMS_LINE_GAP = 1;
const TERMS_CHECKBOX_SIZE = 24;
const TERMS_ROW_MIN_HEIGHT = 42;

export const AuthTermsConsent = memo(function AuthTermsConsent({
  checked,
  onToggle,
  isRTL,
  tCommon,
}: {
  checked: boolean;
  onToggle: () => void;
  isRTL: boolean;
  tCommon: TermsCopy;
}) {
  const styles = useAuthPrimitiveStyles();
  const { s } = useAuthScale();
  const ageLine = tCommon.registerAgreementAfterLinks.replace(/^[،,\s]+/, '');

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onToggle}
      style={[styles.termsRow, isRTL && styles.termsRowRtl]}
    >
      <View style={[styles.termsTextWrap, isRTL && styles.termsTextWrapRtl]}>
        <Text style={[styles.termsLine, isRTL && styles.termsLineRtl]}>
          {tCommon.registerAgreementPrefix}{' '}
          <Text
            style={styles.termsLink}
            onPress={() => {
              void openLegalUrl(LEGAL_URLS.terms);
            }}
          >
            {tCommon.registerTermsLink}
          </Text>
          {isRTL ? ' &' : ' & '}
          <Text
            style={styles.termsLink}
            onPress={() => {
              void openLegalUrl(LEGAL_URLS.privacy);
            }}
          >
            {tCommon.registerPrivacyLink}
          </Text>
          {isRTL ? '،' : ','}
        </Text>
        <Text style={[styles.termsLine, isRTL && styles.termsLineRtl]}>{ageLine}</Text>
      </View>

      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Check size={s(14)} color="#fff" strokeWidth={2.5} /> : null}
      </View>
    </TouchableOpacity>
  );
});
AuthTermsConsent.displayName = 'AuthTermsConsent';

/**
 * Every number below is a Figma DESIGN unit, converted at render time by the
 * shell's scale (./authLayoutMetrics). Before this the panel was hard-coded in
 * design units while the hero scaled with the screen, so the two disagreed
 * about how big the phone was — the source of the pre-login layout problems on
 * iPhone. Sizes go through `s()`, type through `f()`.
 *
 * Note the touch-target floor on the primary button and the social row: at the
 * minimum scale (0.8) 56 → 45 and 54 → 43, so the social buttons are pinned to
 * 44 rather than allowed to fall under the accessibility minimum.
 */
const MIN_TOUCH_TARGET = 44;

function useAuthPrimitiveStyles() {
  const { s, f, scale, fontScale } = useAuthScale();

  return useMemo(
    () => createAuthPrimitiveStyles(s, f),
    // `s`/`f` are new closures each render; the multipliers are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, fontScale],
  );
}

function createAuthPrimitiveStyles(s: (v: number) => number, f: (v: number) => number) {
  return StyleSheet.create({
  panelTitle: {
    fontSize: f(26),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  panelSubtitle: {
    fontSize: f(19),
    color: AUTH_TEXT_SUBTITLE,
    textAlign: 'center',
  },
  primaryBtn: {
    height: Math.max(s(56), MIN_TOUCH_TARGET),
    borderRadius: s(16),
    backgroundColor: AUTH_BUTTON_SOLID,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryTxt: {
    fontSize: f(16),
    fontWeight: '700',
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(22),
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: AUTH_DIVIDER_LINE,
  },
  dividerTxt: {
    fontSize: f(14),
    fontWeight: '500',
    color: AUTH_DIVIDER_TEXT,
  },
  socialRow: {
    flexDirection: 'row',
    gap: s(SOCIAL_ROW_GAP),
    width: '100%',
    height: Math.max(s(SOCIAL_BTN_HEIGHT), MIN_TOUCH_TARGET),
  },
  socialBtnOuter: {
    flex: 1,
    height: Math.max(s(SOCIAL_BTN_HEIGHT), MIN_TOUCH_TARGET),
    borderRadius: s(SOCIAL_BTN_RADIUS),
    borderWidth: Platform.OS === 'ios' ? 0.5 : StyleSheet.hairlineWidth,
    borderColor: AUTH_SOCIAL_BORDER,
    backgroundColor: AUTH_SOCIAL_BG,
    overflow: 'hidden',
  },
  socialBtnInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(SOCIAL_BTN_PADDING_H),
    paddingVertical: s(SOCIAL_BTN_PADDING_V),
    gap: s(10),
  },
  socialIcon: {
    width: s(SOCIAL_ICON_SIZE),
    height: s(SOCIAL_ICON_SIZE),
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
    paddingBottom: s(4),
  },
  footerRowRtl: {
    flexDirection: 'row-reverse',
  },
  footerMuted: {
    fontSize: f(14),
    fontWeight: '500',
    color: AUTH_TEXT_MUTED,
  },
  footerLink: {
    fontSize: f(14),
    fontWeight: '600',
    color: AUTH_ACCENT,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
    width: '100%',
    minHeight: Math.max(s(TERMS_ROW_MIN_HEIGHT), MIN_TOUCH_TARGET),
  },
  termsRowRtl: {
    flexDirection: 'row-reverse',
  },
  termsTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: s(TERMS_LINE_GAP),
  },
  termsTextWrapRtl: {
    alignItems: 'flex-end',
  },
  termsLine: {
    fontSize: f(TERMS_FONT_SIZE),
    lineHeight: f(TERMS_LINE_HEIGHT),
    color: AUTH_TEXT_MUTED,
  },
  termsLineRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  termsLink: {
    color: AUTH_ACCENT,
    fontSize: f(TERMS_FONT_SIZE),
    lineHeight: f(TERMS_LINE_HEIGHT),
  },
  checkbox: {
    width: s(TERMS_CHECKBOX_SIZE),
    height: s(TERMS_CHECKBOX_SIZE),
    borderRadius: s(6),
    borderWidth: 1,
    borderColor: AUTH_CHECKBOX_BORDER,
    backgroundColor: AUTH_CHECKBOX_BG,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxOn: {
    borderColor: AUTH_ACCENT,
    backgroundColor: AUTH_ACCENT,
  },
  });
}
