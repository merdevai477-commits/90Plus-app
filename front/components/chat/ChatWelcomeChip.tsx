import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { chatColors, chatRadii, chatTypography } from './chatTheme';
import { useTranslation } from '../../src/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ChatWelcomeChipProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
};

export function ChatWelcomeChip({ icon, title, subtitle, onPress }: ChatWelcomeChipProps) {
  const { language } = useTranslation();
  const isAr = language === 'ar';
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, { stiffness: 420, damping: 24 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { stiffness: 420, damping: 24 });
      }}
      style={[styles.card, isAr && styles.cardRtl, animStyle]}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      <LinearGradient
        colors={['rgba(124,58,237,0.28)', 'rgba(76,29,149,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, isAr && styles.textRtl]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, isAr && styles.textRtl]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {isAr ? (
        <ChevronLeft size={18} color={chatColors.accentSoft} strokeWidth={2.2} />
      ) : (
        <ChevronRight size={18} color={chatColors.accentSoft} strokeWidth={2.2} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: chatRadii.lg,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: 'rgba(16,10,28,0.92)',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: chatColors.accentDeep,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  cardRtl: {
    flexDirection: 'row-reverse',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,181,253,0.28)',
    flexShrink: 0,
  },
  textWrap: { flex: 1, minWidth: 0 },
  title: {
    ...chatTypography.chipTitle,
    color: chatColors.textPrimary,
  },
  subtitle: {
    ...chatTypography.chipSubtitle,
    color: chatColors.textMuted,
    marginTop: 2,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
