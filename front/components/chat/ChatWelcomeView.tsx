import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Trophy,
  BarChart3,
  Dumbbell,
  Salad,
  HeartPulse,
  Sparkles,
} from 'lucide-react-native';
import { chatScreenStyles as styles } from './chatScreen.styles';
import { ChatWelcomeChip } from './ChatWelcomeChip';
import { chatColors } from './chatTheme';

const CHIP_ICON_SIZE = 20;
const CHIP_ICON_COLOR = chatColors.accentSoft;

export type ChatWelcomeViewProps = {
  greetingName: string;
  onSuggestionPress: (text: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tChat: any;
};

export const ChatWelcomeView = React.memo(function ChatWelcomeView({
  greetingName,
  onSuggestionPress,
  tChat,
}: ChatWelcomeViewProps) {
  const greeting = (tChat.welcomeGreeting as string).replace('{name}', greetingName);

  const suggestions = useMemo(
    () => [
      {
        icon: <Trophy size={CHIP_ICON_SIZE} color={CHIP_ICON_COLOR} strokeWidth={2} />,
        title: tChat.suggestionFootballInfo,
        subtitle: tChat.suggestionFootballInfoSub,
        prompt: tChat.suggestionFootballInfoPrompt,
      },
      {
        icon: <BarChart3 size={CHIP_ICON_SIZE} color={CHIP_ICON_COLOR} strokeWidth={2} />,
        title: tChat.suggestionLeagueStats,
        subtitle: tChat.suggestionLeagueStatsSub,
        prompt: tChat.suggestionLeagueStatsPrompt,
      },
      {
        icon: <Dumbbell size={CHIP_ICON_SIZE} color={CHIP_ICON_COLOR} strokeWidth={2} />,
        title: tChat.suggestionTrainingPlan,
        subtitle: tChat.suggestionTrainingPlanSub,
        prompt: tChat.suggestionTrainingPlanPrompt,
      },
      {
        icon: <Salad size={CHIP_ICON_SIZE} color={CHIP_ICON_COLOR} strokeWidth={2} />,
        title: tChat.suggestionDietPlan,
        subtitle: tChat.suggestionDietPlanSub,
        prompt: tChat.suggestionDietPlanPrompt,
      },
      {
        icon: <HeartPulse size={CHIP_ICON_SIZE} color={CHIP_ICON_COLOR} strokeWidth={2} />,
        title: tChat.suggestionRecoveryTips,
        subtitle: tChat.suggestionRecoveryTipsSub,
        prompt: tChat.suggestionRecoveryTipsPrompt,
      },
    ],
    [tChat],
  );

  return (
    <ScrollView
      style={styles.welcomeScroll}
      contentContainerStyle={styles.welcomeContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.welcomeHero}>
        <View style={styles.welcomeMarkGlow}>
          <LinearGradient
            colors={['#7C3AED', '#4C1D95']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.welcomeMark}
          >
            <Sparkles size={24} color="#FFFFFF" strokeWidth={2.2} />
          </LinearGradient>
        </View>
        <Text style={styles.welcomeTitle}>{greeting}</Text>
        <Text style={styles.welcomeSubtitle}>{tChat.welcomeSubtitle}</Text>
        <View style={styles.welcomeBrandPill}>
          <Text style={styles.welcomeBrand}>{tChat.welcomeBrand}</Text>
        </View>
        <View style={styles.welcomeOnline}>
          <View style={styles.welcomeOnlineDot} />
          <Text style={styles.welcomeOnlineText}>{tChat.welcomeOnline}</Text>
        </View>
      </View>

      <View style={styles.welcomeChips}>
        {suggestions.map((item) => (
          <ChatWelcomeChip
            key={item.title}
            icon={item.icon}
            title={item.title}
            subtitle={item.subtitle}
            onPress={() => onSuggestionPress(item.prompt)}
          />
        ))}
      </View>
    </ScrollView>
  );
});
