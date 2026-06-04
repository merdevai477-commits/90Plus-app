import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import * as Haptics from 'expo-haptics';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { glassProps } from '../../constants/ui';
import { formatVideoUploadCooldown } from '../../utils/profileErrorHelpers';

// Brand purple accent
const PURPLE = '#A855F7';
const PURPLE_DARK = '#7C3AED';

interface CooldownInfo {
  canChange: boolean;
  daysRemaining: number;
  hoursRemaining: number;
}

interface ActionButtonsProps {
  onEditPress: () => void;
  onSharePress: () => void;
  onQRPress?: () => void;
  uploadCooldown?: CooldownInfo | null;
  reelUploadActive?: boolean;
  reelUploadProgress?: number;
}

function formatCooldown(c: CooldownInfo): string {
  if (c.daysRemaining > 0) return `${c.daysRemaining}d ${c.hoursRemaining}h`;
  return `${c.hoursRemaining}h`;
}

// Reusable glass button wrapper
function GlassBtn({
  style,
  children,
}: {
  style?: any;
  children: React.ReactNode;
}) {
  const Wrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const props = isLiquidGlassSupported
    ? { ...glassProps.chip, interactive: true }
    : glassProps.chip;
  return (
    <Wrapper {...(props as any)} style={[styles.btn, style]}>
      {children}
    </Wrapper>
  );
}

export default function ActionButtons({
  onEditPress,
  onSharePress,
  onQRPress,
  uploadCooldown,
  reelUploadActive = false,
  reelUploadProgress = 0,
}: ActionButtonsProps) {
  const { t } = useTranslation();
  const isOnCooldown = uploadCooldown && !uploadCooldown.canChange;

  const cooldownAlertMessage = (c: CooldownInfo) =>
    formatVideoUploadCooldown(t, c.daysRemaining, c.hoursRemaining);

  const handleUploadPress = () => {
    if (reelUploadActive) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const pct = Math.round(reelUploadProgress);
      Alert.alert(
        t.pushTemplates.reelUploadingTitle,
        pct > 0
          ? t.profile.reelUploadInProgressBody.replace('{percent}', String(pct))
          : t.profile.reelUploadInProgressBodyIndeterminate,
        [{ text: t.profile.okay }],
      );
      return;
    }
    if (isOnCooldown && uploadCooldown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(t.profile.waitABit, cooldownAlertMessage(uploadCooldown), [
        { text: t.profile.okay },
      ]);
    } else {
      onEditPress();
    }
  };

  return (
    <View style={styles.container}>

      {/* ── Upload button — liquid glass ─────────────────────────── */}
      <TouchableOpacity
        onPress={handleUploadPress}
        activeOpacity={0.82}
        style={styles.uploadWrap}
      >
        {reelUploadActive ? (
          /* Uploading state — green tint */
          <GlassBtn style={styles.uploadingBtn}>
            <LinearGradient
              colors={['rgba(34,197,94,0.25)', 'rgba(22,163,74,0.1)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <ActivityIndicator size="small" color={ProfileTheme.colors.neonGreen} />
            <Text style={[styles.btnText, { color: ProfileTheme.colors.neonGreen }]} numberOfLines={1}>
              {reelUploadProgress > 0
                ? t.profile.uploadingProgressLabel.replace(
                    '{percent}',
                    String(Math.round(reelUploadProgress)),
                  )
                : t.profile.uploadingLabel}
            </Text>
          </GlassBtn>
        ) : isOnCooldown && uploadCooldown ? (
          /* Cooldown state — red tint */
          <GlassBtn style={styles.cooldownBtn}>
            <LinearGradient
              colors={['rgba(239,68,68,0.2)', 'rgba(220,38,38,0.08)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name="time-outline" size={17} color="#FF6B6B" />
            <Text style={[styles.btnText, { color: '#FF6B6B' }]}>
              {formatCooldown(uploadCooldown)}
            </Text>
          </GlassBtn>
        ) : (
          /* Normal state — pure liquid glass, no tint */
          <GlassBtn style={styles.uploadNormalBtn}>
            <Ionicons name="add-circle-outline" size={17} color="rgba(255,255,255,0.9)" />
            <Text style={styles.btnText}>{t.profile.uploadVideo}</Text>
          </GlassBtn>
        )}
      </TouchableOpacity>

      {/* ── Share button — purple gradient ───────────────────────── */}
      <TouchableOpacity onPress={onSharePress} activeOpacity={0.82} style={styles.shareWrap}>
        <LinearGradient
          colors={[PURPLE, PURPLE_DARK]}
          style={[styles.btn, styles.shareBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="share-social" size={17} color="#fff" />
          <Text style={styles.btnText}>{t.profile.share}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── QR button — purple tint ───────────────────────────────── */}
      {onQRPress && (
        <TouchableOpacity onPress={onQRPress} activeOpacity={0.82}>
          <LinearGradient
            colors={[`${PURPLE}33`, `${PURPLE_DARK}1A`]}
            style={[styles.btn, styles.qrBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="qr-code" size={18} color={PURPLE} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 10,
  },
  uploadWrap: { flex: 1 },
  shareWrap: { flex: 1 },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 48,
    overflow: 'hidden',
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Upload variants */
  uploadNormalBtn: {
    borderColor: 'rgba(255,255,255,0.12)',
  },
  uploadingBtn: {
    borderColor: 'rgba(34,197,94,0.35)',
  },
  cooldownBtn: {
    borderColor: 'rgba(239,68,68,0.3)',
  },

  /* Share */
  shareBtn: {
    borderColor: 'rgba(168,85,247,0.4)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },

  /* QR */
  qrBtn: {
    borderColor: 'rgba(168,85,247,0.3)',
    width: 48,
    paddingHorizontal: 0,
    flex: undefined,
  },
});
