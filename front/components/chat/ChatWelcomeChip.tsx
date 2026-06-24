import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { chatColors, chatRadii, chatTypography } from './chatTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ChatWelcomeChipProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
};

export function ChatWelcomeChip({ icon, title, subtitle, onPress }: ChatWelcomeChipProps) {
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
      style={[styles.card, animStyle]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <LinearGradient
        colors={['rgba(124,58,237,0.22)', 'rgba(76,29,149,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {Platform.OS === 'ios' && (
        <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: chatRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: chatColors.composerBorder,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: chatColors.bgSurface,
    ...Platform.select({
      ios: {
        shadowColor: chatColors.accentDeep,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,181,253,0.25)',
    marginRight: 14,
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
  chevron: {
    fontSize: 22,
    color: chatColors.textFaint,
    marginLeft: 8,
    lineHeight: 24,
  },
});
