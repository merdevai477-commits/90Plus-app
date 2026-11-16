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
import { Check, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LEGAL_URLS, openLegalUrl } from '@/config/legal.config';
import { useAuthScale } from './authLayoutMetrics';
import { useAuthTheme } from './useAuthTheme';
import { AppleLogo, GoogleLogo } from './AuthSocialIcons';

const SOCIAL_BTN_HEIGHT = 50;
const SOCIAL_BTN_RADIUS = 14;
const SOCIAL_ICON_SIZE = 24;
const SOCIAL_ROW_GAP = 12;
const MIN_TOUCH_TARGET = 44;

export function AuthPanelHeader({
  title,
  subtitle,
  align = 'end',
}: {
  title: string;
  subtitle: string;
  align?: 'center' | 'end';
}) {
  const styles = useAuthPrimitiveStyles();
  const end = align === 'end';

  return (
    <View style={[styles.headerBlock, end && styles.headerBlockEnd]}>
      <Text style={[styles.panelTitle, end && styles.textEnd]}>{title}</Text>
      <Text style={[styles.panelSubtitle, end && styles.textEnd]}>{subtitle}</Text>
    </View>
  );
}

export function AuthPrimaryButton({
  label,
  loading,
  loadingLabel,
  onPress,
  disabled,
  style,
  showArrow = true,
  isRTL,
}: {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  showArrow?: boolean;
  isRTL?: boolean;
}) {
  const styles = useAuthPrimitiveStyles();
  const { colors } = useAuthTheme();
  const { s } = useAuthScale();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      disabled={disabled || loading}
      style={[{ width: '100%' }, (disabled || loading) && { opacity: 0.6 }, style]}
    >
      <LinearGradient
        colors={[...colors.buttonGradient]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.primaryBtn}
      >
        {showArrow ? (
          <View style={styles.primaryArrowSlot}>
            <Arrow size={s(18)} color="#fff" strokeWidth={2.5} />
          </View>
        ) : (
          <View style={styles.primaryArrowSlot} />
        )}
        <Text style={styles.primaryTxt}>
          {loading ? (loadingLabel ?? label) : label}
        </Text>
        <View style={styles.primaryArrowSlot} />
      </LinearGradient>
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

function AuthSocialButton({
  onPress,
  disabled,
  loading,
  label,
  icon,
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  const styles = useAuthPrimitiveStyles();
  const { colors } = useAuthTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.socialBtnOuter, (disabled || loading) && { opacity: 0.6 }]}
    >
      <View style={styles.socialBtnInner}>
        {loading ? (
          <ActivityIndicator color={colors.textPrimary} size="small" />
        ) : (
          <>
            {icon}
            <Text style={styles.socialLabel}>{label}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
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
  const { colors } = useAuthTheme();
  const { s } = useAuthScale();
  const iconSize = s(SOCIAL_ICON_SIZE);

  return (
    <View style={styles.socialRow}>
      <AuthSocialButton
        onPress={onGoogle}
        disabled={loading}
        loading={googleLoading}
        label="Google"
        icon={<GoogleLogo size={iconSize} />}
      />
      <AuthSocialButton
        onPress={onApple}
        disabled={loading}
        loading={appleLoading}
        label="Apple"
        icon={<AppleLogo size={iconSize} color={colors.textPrimary} />}
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

export function AuthRememberRow({
  remembered,
  onToggleRemember,
  onForgot,
  rememberLabel,
  forgotLabel,
  isRTL,
}: {
  remembered: boolean;
  onToggleRemember: () => void;
  onForgot: () => void;
  rememberLabel: string;
  forgotLabel: string;
  isRTL?: boolean;
}) {
  const styles = useAuthPrimitiveStyles();
  const { colors } = useAuthTheme();
  const { s } = useAuthScale();

  // Figma keeps forgot on the left and remember+checkbox on the right in both
  // languages (Login 1613:5829), so we do not flip this row for RTL.
  return (
    <View style={styles.rememberRow}>
      <Pressable onPress={onForgot} hitSlop={8}>
        <Text style={styles.forgotLink}>{forgotLabel}</Text>
      </Pressable>
      <Pressable
        onPress={onToggleRemember}
        hitSlop={8}
        style={[styles.rememberRight, isRTL && styles.rememberRightRtl]}
      >
        <Text style={styles.rememberLabel}>{rememberLabel}</Text>
        <View style={[styles.checkbox, remembered && styles.checkboxOn]}>
          {remembered ? (
            <Check size={s(14)} color="#fff" strokeWidth={2.5} />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

type TermsCopy = {
  registerAgreementPrefix: string;
  registerTermsLink: string;
  registerPrivacyLink: string;
  registerAgreementAfterLinks: string;
};

const TERMS_FONT_SIZE = 12;
const TERMS_LINE_HEIGHT = 16;
const TERMS_LINE_GAP = 1;
const TERMS_CHECKBOX_SIZE = 22;
const TERMS_ROW_MIN_HEIGHT = 40;

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

function useAuthPrimitiveStyles() {
  const { s, f, scale, fontScale } = useAuthScale();
  const { colors, scheme } = useAuthTheme();

  return useMemo(
    () => createAuthPrimitiveStyles(s, f, colors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, fontScale, scheme],
  );
}

function createAuthPrimitiveStyles(
  s: (v: number) => number,
  f: (v: number) => number,
  colors: ReturnType<typeof useAuthTheme>['colors'],
) {
  return StyleSheet.create({
    headerBlock: {
      width: '100%',
      gap: s(6),
    },
    headerBlockEnd: {
      alignItems: 'flex-end',
    },
    textEnd: {
      textAlign: 'right',
      width: '100%',
    },
    panelTitle: {
      fontSize: f(28),
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: f(38),
    },
    panelSubtitle: {
      fontSize: f(13),
      fontWeight: '400',
      color: colors.textSecondary,
      lineHeight: f(18),
    },
    primaryBtn: {
      height: Math.max(s(54), MIN_TOUCH_TARGET),
      borderRadius: s(16),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: s(22),
    },
    primaryTxt: {
      fontSize: f(16),
      fontWeight: '700',
      color: '#fff',
      textAlign: 'center',
      flex: 1,
    },
    primaryArrowSlot: {
      width: s(25),
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(12),
      width: '100%',
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.divider,
    },
    dividerTxt: {
      fontSize: f(12),
      fontWeight: '600',
      color: colors.textSecondary,
      lineHeight: f(16),
    },
    socialRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: s(SOCIAL_ROW_GAP),
      width: '100%',
      height: Math.max(s(SOCIAL_BTN_HEIGHT), MIN_TOUCH_TARGET),
    },
    socialBtnOuter: {
      flex: 1,
      height: Math.max(s(SOCIAL_BTN_HEIGHT), MIN_TOUCH_TARGET),
      borderRadius: s(SOCIAL_BTN_RADIUS),
      borderWidth: 1,
      borderColor: colors.socialBorder,
      backgroundColor: colors.socialBg,
      overflow: 'hidden',
    },
    socialBtnInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s(12),
      gap: s(7),
    },
    socialLabel: {
      fontSize: f(13),
      fontWeight: '600',
      color: colors.textPrimary,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(6),
      paddingBottom: s(4),
    },
    footerRowRtl: {
      flexDirection: 'row-reverse',
    },
    footerMuted: {
      fontSize: f(13),
      fontWeight: '400',
      color: colors.textSecondary,
    },
    footerLink: {
      fontSize: f(13),
      fontWeight: '600',
      color: colors.primary,
    },
    rememberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      minHeight: s(36),
    },
    rememberRowRtl: {
      flexDirection: 'row-reverse',
    },
    rememberRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(8),
    },
    rememberRightRtl: {
      flexDirection: 'row-reverse',
    },
    rememberLabel: {
      fontSize: f(12),
      fontWeight: '400',
      color: colors.textSecondary,
    },
    forgotLink: {
      fontSize: f(12),
      fontWeight: '600',
      color: colors.primary,
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
      color: colors.textSecondary,
    },
    termsLineRtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    termsLink: {
      color: colors.primary,
      fontSize: f(TERMS_FONT_SIZE),
      lineHeight: f(TERMS_LINE_HEIGHT),
      fontWeight: '600',
    },
    checkbox: {
      width: s(TERMS_CHECKBOX_SIZE),
      height: s(TERMS_CHECKBOX_SIZE),
      borderRadius: s(6),
      borderWidth: 1,
      borderColor: colors.checkboxBorder,
      backgroundColor: colors.checkboxBg,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    checkboxOn: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
  });
}
