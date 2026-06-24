import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import {
  Trophy,
  BarChart3,
  Dumbbell,
  Salad,
  HeartPulse,
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
        prompt: tChat.suggestionFootballInfoPrompt,
      },
      {
        icon: <BarChart3 size={CHIP_ICON_SIZE} color={CHIP_ICON_COLOR} strokeWidth={2} />,
        title: tChat.suggestionLeagueStats,
        prompt: tChat.suggestionLeagueStatsPrompt,
      },
      {
        icon: <Dumbbell size={CHIP_ICON_SIZE} color={CHIP_ICON_COLOR} strokeWidth={2} />,
        title: tChat.suggestionTrainingPlan,
        prompt: tChat.suggestionTrainingPlanPrompt,
      },
      {
        icon: <Salad size={CHIP_ICON_SIZE} color={CHIP_ICON_COLOR} strokeWidth={2} />,
        title: tChat.suggestionDietPlan,
        prompt: tChat.suggestionDietPlanPrompt,
      },
      {
        icon: <HeartPulse size={CHIP_ICON_SIZE} color={CHIP_ICON_COLOR} strokeWidth={2} />,
        title: tChat.suggestionRecoveryTips,
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
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.welcomeHero}>
        <Text style={styles.welcomeTitle}>{greeting}</Text>
        <Text style={styles.welcomeSubtitle}>{tChat.welcomeSubtitle}</Text>
        <Text style={styles.welcomeBrand}>{tChat.welcomeBrand}</Text>
      </View>

      <View style={styles.welcomeChips}>
        {suggestions.map((item) => (
          <ChatWelcomeChip
            key={item.title}
            icon={item.icon}
            title={item.title}
            onPress={() => onSuggestionPress(item.prompt)}
          />
        ))}
      </View>
    </ScrollView>
  );
});
