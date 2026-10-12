import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { chatScreenStyles as styles } from './chatScreen.styles';
import { ChatRimButton } from './ChatRimButton';

export type ChatHeaderProps = {
  onBack: () => void;
  onMenu: () => void;
  backLabel: string;
  menuLabel: string;
};

/** Barless header: just back and more buttons floating over the chat background. */
export function ChatHeader({ onBack, onMenu, backLabel, menuLabel }: ChatHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <ChatRimButton onPress={onBack} accessibilityLabel={backLabel}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
            <Path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </ChatRimButton>

        <ChatRimButton onPress={onMenu} accessibilityLabel={menuLabel}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="white">
            <Circle cx="5" cy="12" r="2" />
            <Circle cx="12" cy="12" r="2" />
            <Circle cx="19" cy="12" r="2" />
          </Svg>
        </ChatRimButton>
      </View>
    </View>
  );
}
