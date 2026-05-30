import React from 'react';
import { View, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatScreenBackground } from './ChatScreenBackground';
import { chatScreenStyles as styles } from './chatScreen.styles';

export type ChatScreenLayoutProps = {
  header: React.ReactNode;
  historyPanel: React.ReactNode;
  messageArea: React.ReactNode;
  composer: React.ReactNode;
  connToast?: React.ReactNode;
  useKeyboardAvoiding?: boolean;
};

/**
 * Column layout: header (fixed) → clipped messages → composer.
 * iOS Expo Go: KeyboardAvoidingView around list + composer only.
 */
export function ChatScreenLayout({
  header,
  historyPanel,
  messageArea,
  composer,
  connToast,
  useKeyboardAvoiding = false,
}: ChatScreenLayoutProps) {
  const mainColumn = (
    <>
      {connToast}
      <View style={styles.listRegion}>{messageArea}</View>
      {composer}
    </>
  );

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right']}>
      <ChatScreenBackground />
      {historyPanel}
      <View style={styles.screen}>
        {header}
        {useKeyboardAvoiding ? (
          <KeyboardAvoidingView style={styles.body} behavior="padding" keyboardVerticalOffset={0}>
            {mainColumn}
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.body}>{mainColumn}</View>
        )}
      </View>
    </SafeAreaView>
  );
}
