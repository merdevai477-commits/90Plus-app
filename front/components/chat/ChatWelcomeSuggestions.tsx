import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Dumbbell, Newspaper, Salad, Trophy, type LucideIcon } from 'lucide-react-native';
import { chatColors } from './chatTheme';
import { useAppFont } from '../../utils/fontSetup';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Cards land one after another once the greeting has settled. */
const FIRST_CARD_DELAY = 620;
const CARD_STAGGER = 90;
const CARD_DURATION = 520;

type Suggestion = {
  key: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  subtitle: string;
  prompt: string;
};

export type ChatWelcomeSuggestionsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tChat: any;
  isAr: boolean;
  onSelect: (prompt: string) => void;
};

function SuggestionCard({
  item,
  index,
  isAr,
  onSelect,
}: {
  item: Suggestion;
  index: number;
  isAr: boolean;
  onSelect: (prompt: string) => void;
}) {
  const titleFont = useAppFont(600);
  const subtitleFont = useAppFont(400);
  const press = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.03 }],
    backgroundColor: `rgba(255,255,255,${0.045 + press.value * 0.04})`,
  }));
  const Icon = item.icon;
  const align = isAr ? styles.alignEnd : styles.alignStart;
  const textAlign = isAr ? 'right' : 'left';

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(FIRST_CARD_DELAY + index * CARD_STAGGER)
        .duration(CARD_DURATION)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })}
      onPressIn={() => { press.value = withTiming(1, { duration: 110 }); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 180 }); }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onSelect(item.prompt);
      }}
      style={[styles.card, align, pressStyle]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.subtitle}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${item.tint}1F`, borderColor: `${item.tint}4D` }]}>
        <Icon size={17} color={item.tint} strokeWidth={2} />
      </View>
      <Text style={[styles.title, { fontFamily: titleFont, textAlign }]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[styles.subtitle, { fontFamily: subtitleFont, textAlign }]} numberOfLines={2}>
        {item.subtitle}
      </Text>
    </AnimatedPressable>
  );
}

export const ChatWelcomeSuggestions = React.memo(function ChatWelcomeSuggestions({
  tChat,
  isAr,
  onSelect,
}: ChatWelcomeSuggestionsProps) {
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
  ];

  return (
    <View style={[styles.grid, isAr && styles.gridRtl]}>
      {items.map((item, index) => (
        <SuggestionCard key={item.key} item={item} index={index} isAr={isAr} onSelect={onSelect} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    alignSelf: 'stretch',
  },
  gridRtl: {
    flexDirection: 'row-reverse',
  },
  card: {
    width: '48.5%',
    minHeight: 112,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(210,190,255,0.18)',
  },
  alignStart: { alignItems: 'flex-start' },
  alignEnd: { alignItems: 'flex-end' },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    alignSelf: 'stretch',
    color: chatColors.textPrimary,
    fontSize: 14,
    letterSpacing: -0.1,
    marginBottom: 3,
  },
  subtitle: {
    alignSelf: 'stretch',
    color: chatColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
});
