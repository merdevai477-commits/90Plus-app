import React, { forwardRef } from 'react';
import type { ScrollViewProps } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { ChatKeyboardScrollView } from '@/utils/keyboardControllerSafe';

export type ChatScrollViewProps = ScrollViewProps & {
  inverted?: boolean;
  extraContentPadding?: SharedValue<number>;
};

/** The list runs to the screen bottom under the floating composer, so no keyboard offset. */
const ChatScrollView = forwardRef<React.ComponentRef<typeof ChatKeyboardScrollView>, ChatScrollViewProps>(
  ({ inverted, extraContentPadding, ...props }, ref) => (
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
      offset={0}
      extraContentPadding={extraContentPadding}
    />
  ),
);

ChatScrollView.displayName = 'ChatScrollView';

export default ChatScrollView;
