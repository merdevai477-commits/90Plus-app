import React from 'react';
import { View, Text } from 'react-native';
import { chatScreenStyles as styles } from './chatScreen.styles';

export type ChatWelcomeViewProps = {
  greetingName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tChat: any;
};

export const ChatWelcomeView = React.memo(function ChatWelcomeView({
  greetingName,
  tChat,
}: ChatWelcomeViewProps) {
  const greeting = (tChat.welcomeGreeting as string).replace('{name}', greetingName);

  return (
    <View style={styles.welcomeScroll}>
      <View style={styles.welcomeContent}>
        <View style={styles.welcomeHero}>
          <Text style={styles.welcomeTitle}>{greeting}</Text>
          <Text style={styles.welcomeSubtitle}>{tChat.welcomeSubtitle}</Text>
          <Text style={styles.welcomeBrand}>{tChat.welcomeBrand}</Text>
        </View>
      </View>
    </View>
  );
});
