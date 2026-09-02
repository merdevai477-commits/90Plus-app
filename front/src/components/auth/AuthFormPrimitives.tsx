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
  AUTH_CHECKBOX_BG,
  AUTH_CHECKBOX_BORDER,
  AUTH_SOCIAL_BG,
  AUTH_SOCIAL_BORDER,
  AUTH_TEXT_MUTED,
} from './AuthTokens';
import { TEXT_PRIMARY } from '../../../constants/tokens';

import { AUTH_V2_ASSETS } from './authV2Assets';

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
      style={[styles.primaryWrap, (disabled || loading) && { opacity: 0.6 }, style]}
    >
      <LinearGradient
        colors={[AUTH_ACCENT, AUTH_BUTTON_GRADIENT_END]}
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
          <Image source={AUTH_V2_ASSETS.iconGoogle} style={styles.socialIcon} contentFit="contain" />
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
          <Image source={AUTH_V2_ASSETS.iconApple} style={styles.socialIcon} contentFit="contain" />
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
    <Pressable style={styles.footer} onPress={onPress}>
      <Text style={[styles.footerRow, isRTL && styles.footerRowRtl]}>
        <Text style={styles.footerMuted}>{muted} </Text>
        <Text style={styles.footerLink}>{link}</Text>
      </Text>
    </Pressable>
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
    marginBottom: 28,
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
    color: '#a2a2a2',
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
    backgroundColor: 'rgba(87, 87, 87, 0.5)',
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
  },
  socialIcon: {
    width: 24,
    height: 24,
  },
  footer: {
    marginTop: 14,
    alignItems: 'center',
    paddingBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    lineHeight: 22,
    color: AUTH_TEXT_MUTED,
  },
  termsLineRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  termsSecondLine: {
    marginTop: 2,
  },
  termsLink: {
    color: AUTH_ACCENT,
    textDecorationLine: 'underline',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
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
