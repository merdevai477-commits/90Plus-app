import React from 'react';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { chatScreenStyles as styles } from './chatScreen.styles';
import { ChatIridescentBubble } from './ChatIridescentBubble';
import { chatSpacing } from './chatTheme';

export type ChatWelcomeViewProps = {
  greetingName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tChat: any;
  /** Height of the floating composer overlapping the bottom of the scroll. */
  bottomInset?: number;
};

export const ChatWelcomeView = React.memo(function ChatWelcomeView({
  greetingName,
  tChat,
  bottomInset = 0,
}: ChatWelcomeViewProps) {
  const { width } = useWindowDimensions();
  const greeting = (tChat.welcomeGreeting as string).replace('{name}', greetingName);
  const bubbleSize = Math.min(width * 0.6, 240);

  return (
    <ScrollView
      style={styles.welcomeScroll}
      contentContainerStyle={[
        styles.welcomeContent,
        { paddingBottom: chatSpacing.welcomeBottom + bottomInset },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.welcomeHero}>
        <View style={styles.welcomeBubble}>
          <ChatIridescentBubble size={bubbleSize} />
        </View>
        <Text style={styles.welcomeTitle}>{greeting}</Text>
        <Text style={styles.welcomeSubtitle}>{tChat.welcomeSubtitle}</Text>
      </View>
    </ScrollView>
  );
});
