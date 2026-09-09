import React, { forwardRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';
import { ChatKeyboardScrollView } from '@/utils/keyboardControllerSafe';
import { CHAT_BOTTOM_OFFSET_MARGIN } from './chatTheme';

export type ChatScrollViewProps = ScrollViewProps & {
  inverted?: boolean;
  extraContentPadding?: SharedValue<number>;
};

const ChatScrollView = forwardRef<React.ComponentRef<typeof ChatKeyboardScrollView>, ChatScrollViewProps>(
  ({ inverted, extraContentPadding, ...props }, ref) => {
    const { bottom } = useSafeAreaInsets();

    return (
      <ChatKeyboardScrollView
        ref={ref}
        {...props}
        inverted={inverted}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="interactive"
        keyboardLiftBehavior="whenAtEnd"
        bounces={false}
        overScrollMode="never"
        offset={Math.max(0, bottom - CHAT_BOTTOM_OFFSET_MARGIN)}
        extraContentPadding={extraContentPadding}
      />
    );
  },
);

ChatScrollView.displayName = 'ChatScrollView';

export default ChatScrollView;
