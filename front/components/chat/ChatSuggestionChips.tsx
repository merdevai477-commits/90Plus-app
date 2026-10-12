/**
 * Ready-made prompts as a swipeable row of liquid-glass chips floating above
 * the composer. Fixed-width chips leave the next one peeking in so the row
 * reads as scrollable.
 */

import React, { useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Dumbbell,
  HeartPulse,
  Newspaper,
  Salad,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { LiquidWaterSurface } from './LiquidWaterSurface';
import { IridescentRim } from './IridescentRim';
import { chatColors } from './chatTheme';
import { useAppFont } from '../../utils/fontSetup';

const CHIP_WIDTH = 226;
const CHIP_HEIGHT = 58;
const CHIP_RADIUS = CHIP_HEIGHT / 2;
const CHIP_GAP = 10;
const ROW_INSET = 20;
/** IridescentRim draws its glow this far outside the chip; the row pads for it so nothing clips. */
const RIM_GLOW = 10;
const CHIP_TINT = 'rgba(3,2,8,0.9)';
const CHIP_CAUSTIC: [number, number, number] = [0.6, 0.75, 1];

const FIRST_CHIP_DELAY = 520;
const CHIP_STAGGER = 80;
const CHIP_DURATION = 480;

type Suggestion = {
  key: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  subtitle: string;
  prompt: string;
};

export type ChatSuggestionChipsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tChat: any;
  isAr: boolean;
  onSelect: (prompt: string) => void;
  /** Android: the chat content view the glass frosts. */
  blurTarget?: React.RefObject<View | null>;
};

function SuggestionChip({
  item,
  index,
  isAr,
  onSelect,
  blurTarget,
}: {
  item: Suggestion;
  index: number;
  isAr: boolean;
  onSelect: (prompt: string) => void;
  blurTarget?: React.RefObject<View | null>;
}) {
  const titleFont = useAppFont(600);
  const subtitleFont = useAppFont(400);
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const Icon = item.icon;
  const textAlign = isAr ? 'right' : 'left';

  return (
    <Animated.View
      entering={FadeInDown.delay(FIRST_CHIP_DELAY + index * CHIP_STAGGER)
        .duration(CHIP_DURATION)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}
      style={pressStyle}
    >
      <Pressable
        onPressIn={() => { press.value = withTiming(0.96, { duration: 110 }); }}
        onPressOut={() => { press.value = withTiming(1, { duration: 180 }); }}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onSelect(item.prompt);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle}`}
      >
        <LiquidWaterSurface
          radius={CHIP_RADIUS}
          tint={CHIP_TINT}
          glow={CHIP_CAUSTIC}
          strength={0.12}
          sheen={0.12}
          blurTarget={blurTarget}
          style={[styles.chip, isAr && styles.chipRtl]}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${item.tint}24`, borderColor: `${item.tint}55` }]}>
            <Icon size={16} color={item.tint} strokeWidth={2.1} />
          </View>
          <View style={styles.texts}>
            <Text style={[styles.title, { fontFamily: titleFont, textAlign }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.subtitle, { fontFamily: subtitleFont, textAlign }]} numberOfLines={1}>
              {item.subtitle}
            </Text>
          </View>
        </LiquidWaterSurface>
        <IridescentRim radius={CHIP_RADIUS} filmDepth={8} />
      </Pressable>
    </Animated.View>
  );
}

export const ChatSuggestionChips = React.memo(function ChatSuggestionChips({
  tChat,
  isAr,
  onSelect,
  blurTarget,
}: ChatSuggestionChipsProps) {
  const scrollRef = useRef<ScrollView>(null);
  const items: Suggestion[] = [
    {
      key: 'football',
      icon: Newspaper,
      tint: '#B794FF',
      title: tChat.suggestionFootballInfo,
      subtitle: tChat.suggestionFootballInfoSub,
      prompt: tChat.suggestionFootballInfoPrompt,
    },
    {
      key: 'stats',
      icon: Trophy,
      tint: '#F5C451',
      title: tChat.suggestionLeagueStats,
      subtitle: tChat.suggestionLeagueStatsSub,
      prompt: tChat.suggestionLeagueStatsPrompt,
    },
    {
      key: 'training',
      icon: Dumbbell,
      tint: '#5CC8FF',
      title: tChat.suggestionTrainingPlan,
      subtitle: tChat.suggestionTrainingPlanSub,
      prompt: tChat.suggestionTrainingPlanPrompt,
    },
    {
      key: 'diet',
      icon: Salad,
      tint: '#4ADE9B',
      title: tChat.suggestionDietPlan,
      subtitle: tChat.suggestionDietPlanSub,
      prompt: tChat.suggestionDietPlanPrompt,
    },
    {
      key: 'recovery',
      icon: HeartPulse,
      tint: '#FF8FA3',
      title: tChat.suggestionRecoveryTips,
      subtitle: tChat.suggestionRecoveryTipsSub,
      prompt: tChat.suggestionRecoveryTipsPrompt,
    },
  ];
  /** Horizontal ScrollView ignores RTL here, so Arabic lists right-to-left and starts at the right edge. */
  const ordered = isAr ? [...items].reverse() : items;

  const handleContentSizeChange = useCallback(() => {
    if (isAr) scrollRef.current?.scrollToEnd({ animated: false });
  }, [isAr]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CHIP_WIDTH + CHIP_GAP}
      snapToAlignment="start"
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={handleContentSizeChange}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {ordered.map((item, index) => (
        <SuggestionChip
          key={item.key}
          item={item}
          index={isAr ? ordered.length - 1 - index : index}
          isAr={isAr}
          onSelect={onSelect}
          blurTarget={blurTarget}
        />
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  row: {
    gap: CHIP_GAP,
    paddingHorizontal: ROW_INSET,
    paddingVertical: RIM_GLOW,
  },
  chip: {
    width: CHIP_WIDTH,
    height: CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 9,
    paddingRight: 18,
  },
  chipRtl: {
    flexDirection: 'row-reverse',
    paddingLeft: 18,
    paddingRight: 9,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
  },
  title: {
    color: chatColors.textPrimary,
    fontSize: 13,
    letterSpacing: -0.1,
  },
  subtitle: {
    color: chatColors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
});
