import React from 'react';
import { View, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';

import { ChatScreenBackground } from './ChatScreenBackground';
import { chatScreenStyles as styles } from './chatScreen.styles';

export type ChatScreenLayoutProps = {
  header: React.ReactNode;
  historyPanel: React.ReactNode;
  messageArea: React.ReactNode;
  composer: React.ReactNode;
  connToast?: React.ReactNode;
  useKeyboardAvoiding?: boolean;
  /** Lets the floating composer frost the messages on Android. */
  blurTargetRef?: React.RefObject<View | null>;
};

/**
 * Column layout: header (fixed) → clipped messages, with the composer floating over them.
 * iOS Expo Go: KeyboardAvoidingView around list + composer only.
 */
export function ChatScreenLayout({
  header,
  historyPanel,
  messageArea,
  composer,
  connToast,
  useKeyboardAvoiding = false,
  blurTargetRef,
}: ChatScreenLayoutProps) {
  const mainColumn = (
    <>
      {connToast}
      <BlurTargetView ref={blurTargetRef} style={styles.listRegion}>
        {messageArea}
      </BlurTargetView>
      {composer}
    </>
  );

  return (
    <SafeAreaView collapsable={false} style={styles.root} edges={['left', 'right']}>
      <ChatScreenBackground />
      {historyPanel}
      <View style={styles.screen}>
        {header}
        {useKeyboardAvoiding ? (
          <KeyboardAvoidingView style={styles.body} behavior="padding" keyboardVerticalOffset={0}>
            {mainColumn}
          </KeyboardAvoidingView>
        ) : (
          <View collapsable={false} style={styles.body}>
            {mainColumn}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
