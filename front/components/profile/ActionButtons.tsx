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

function cooldownMessage(c: CooldownInfo): string {
  if (c.daysRemaining > 0)
    return `يمكنك رفع فيديو جديد بعد ${c.daysRemaining} يوم و ${c.hoursRemaining} ساعة`;
  return `يمكنك رفع فيديو جديد بعد ${c.hoursRemaining} ساعة`;
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

  const handleUploadPress = () => {
    if (reelUploadActive) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const pct = Math.round(reelUploadProgress);
      Alert.alert(
        'جاري رفع الريلز',
        pct > 0
          ? `يتم رفع الفيديو (${pct}٪). انتظر حتى يكتمل.`
          : 'يتم رفع الفيديو حالياً. انتظر حتى يكتمل.',
        [{ text: 'حسناً' }]
      );
      return;
    }
    if (isOnCooldown && uploadCooldown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('⏳ انتظر قليلاً', cooldownMessage(uploadCooldown), [
        { text: 'حسناً' },
      ]);
    } else {
      onEditPress();
    }
  };

  return (
    <View style={styles.container}>
      {/* Upload / cooldown button */}
      <TouchableOpacity
        onPress={handleUploadPress}
        activeOpacity={0.82}
        style={styles.uploadWrap}
      >
        {reelUploadActive ? (
          <LinearGradient
            colors={['rgba(34,197,94,0.3)', 'rgba(22,163,74,0.15)']}
            style={[styles.btn, styles.uploadingBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <ActivityIndicator size="small" color={ProfileTheme.colors.neonGreen} />
            <Text style={[styles.btnText, { color: ProfileTheme.colors.neonGreen }]} numberOfLines={1}>
              {reelUploadProgress > 0
                ? `جاري الرفع ${Math.round(reelUploadProgress)}٪`
                : 'جاري الرفع…'}
            </Text>
          </LinearGradient>
        ) : isOnCooldown && uploadCooldown ? (
          (() => {
            const GlassBtn = isLiquidGlassSupported ? LiquidGlassView : BlurView;
            const glassP = isLiquidGlassSupported
              ? { effect: 'clear' as const, interactive: true }
              : { intensity: 40, tint: 'dark' as const };
            return (
              <GlassBtn {...(glassP as any)} style={[styles.btn, styles.cooldownBtn]}>
                <Ionicons name="time-outline" size={17} color="#FF6B6B" />
                <Text style={[styles.btnText, { color: '#FF6B6B' }]}>
                  {formatCooldown(uploadCooldown)}
                </Text>
              </GlassBtn>
            );
          })()
        ) : (
          <LinearGradient
            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']}
            style={styles.btn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="add-circle-outline" size={17} color="#fff" />
            <Text style={styles.btnText}>{t.profile.uploadVideo}</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>

      {/* Share button */}
      <TouchableOpacity onPress={onSharePress} activeOpacity={0.82} style={styles.shareWrap}>
        <LinearGradient
          colors={['#0EA5E9', '#2563EB']}
          style={[styles.btn, styles.shareBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="share-social" size={17} color="#fff" />
          <Text style={styles.btnText}>{t.profile.share}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* QR button */}
      {onQRPress && (
        <TouchableOpacity onPress={onQRPress} activeOpacity={0.82}>
          <LinearGradient
            colors={['rgba(255,215,0,0.22)', 'rgba(255,165,0,0.1)']}
            style={[styles.btn, styles.qrBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="qr-code" size={18} color="#FFD700" />
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
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  uploadingBtn: {
    borderColor: 'rgba(34,197,94,0.35)',
  },
  cooldownBtn: {
    borderColor: 'rgba(255,107,107,0.35)',
    overflow: 'hidden',
  },
  shareBtn: {
    borderColor: 'rgba(14,165,233,0.4)',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  qrBtn: {
    borderColor: 'rgba(255,215,0,0.3)',
    width: 48,
    paddingHorizontal: 0,
    flex: undefined,
  },
});
