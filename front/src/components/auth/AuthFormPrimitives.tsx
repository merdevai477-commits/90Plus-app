import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { LEGAL_URLS, openLegalUrl } from '@/config/legal.config';
import {
  AUTH_ACCENT,
  AUTH_BUTTON_GRADIENT_END,
  AUTH_BUTTON_GRADIENT_START,
  AUTH_CHECKBOX_BG,
  AUTH_CHECKBOX_BORDER,
  AUTH_DIVIDER_LINE,
  AUTH_SOCIAL_BG,
  AUTH_SOCIAL_BORDER,
  AUTH_TEXT_MUTED,
  AUTH_TEXT_SUBTITLE,
} from './AuthTokens';
import { TEXT_PRIMARY } from '../../../constants/tokens';

const googleIcon = require('../../../assets/images/auth/icon-google.svg');
const appleIcon = require('../../../assets/images/auth/icon-apple.svg');

export function AuthPanelHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.panelHeader}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelSubtitle}>{subtitle}</Text>
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
}: {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.primaryWrap,
        (disabled || loading) && { opacity: 0.6 },
        style,
      ]}
    >
      <LinearGradient
        colors={[AUTH_BUTTON_GRADIENT_START, AUTH_BUTTON_GRADIENT_END]}
        style={styles.primaryBtn}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Text style={styles.primaryTxt}>
          {loading ? (loadingLabel ?? label) : label}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function AuthDivider({ label }: { label: string }) {
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
  return (
    <View style={styles.socialRow}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.socialBtn, loading && { opacity: 0.6 }]}
        onPress={onGoogle}
        disabled={loading}
      >
        {googleLoading ? (
          <ActivityIndicator color={TEXT_PRIMARY} size="small" />
        ) : (
          <Image source={googleIcon} style={styles.socialIcon} contentFit="contain" />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.socialBtn, loading && { opacity: 0.6 }]}
        onPress={onApple}
        disabled={loading}
      >
        {appleLoading ? (
          <ActivityIndicator color={TEXT_PRIMARY} size="small" />
        ) : (
          <Image source={appleIcon} style={styles.socialIcon} contentFit="contain" />
        )}
      </TouchableOpacity>
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
  const ageLine = tCommon.registerAgreementAfterLinks.replace(/^[،,\s]+/, '');

  return (
    <TouchableOpacity activeOpacity={1} onPress={onToggle} style={[styles.termsRow, isRTL && styles.termsRowRtl]}>
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
        <Text style={[styles.termsLine, styles.termsSecondLine, isRTL && styles.termsLineRtl]}>
          {ageLine}
        </Text>
      </View>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
      </View>
    </TouchableOpacity>
  );
});
AuthTermsConsent.displayName = 'AuthTermsConsent';

const styles = StyleSheet.create({
  panelHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  panelTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  panelSubtitle: {
    fontSize: 19,
    color: AUTH_TEXT_SUBTITLE,
    textAlign: 'center',
  },
  primaryWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  primaryBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginTop: 41,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: AUTH_DIVIDER_LINE,
  },
  dividerTxt: {
    fontSize: 14,
    fontWeight: '500',
    color: AUTH_TEXT_MUTED,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    height: 54,
  },
  socialBtn: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    backgroundColor: AUTH_SOCIAL_BG,
    borderWidth: 0.5,
    borderColor: AUTH_SOCIAL_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  socialIcon: {
    width: 24,
    height: 24,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
    paddingBottom: 8,
  },
  footerRowRtl: {
    flexDirection: 'row-reverse',
  },
  footerMuted: {
    fontSize: 14,
    fontWeight: '500',
    color: AUTH_TEXT_MUTED,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: AUTH_ACCENT,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    minHeight: 42,
    marginTop: 18,
  },
  termsRowRtl: {
    flexDirection: 'row-reverse',
  },
  termsTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  termsTextWrapRtl: {
    alignItems: 'flex-end',
  },
  termsLine: {
    fontSize: 16,
    lineHeight: 30,
    color: AUTH_TEXT_MUTED,
  },
  termsLineRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  termsSecondLine: {
    marginTop: 12,
  },
  termsLink: {
    color: AUTH_ACCENT,
    textDecorationLine: 'underline',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: AUTH_CHECKBOX_BORDER,
    backgroundColor: AUTH_CHECKBOX_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxOn: {
    borderColor: AUTH_ACCENT,
    backgroundColor: AUTH_ACCENT,
  },
});
