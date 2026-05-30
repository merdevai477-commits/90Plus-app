/**
 * ChatScreen — thin orchestrator for 90Plus AI Chat.
 * UI: ChatScreenLayout + modular components; data: useAIChatNative + useChatProfile.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';

import { useAIChatNative } from '../../hooks/useAIChatNative';
import { useChatProfile, buildProfileSystemPromptSuffix } from '../../hooks/useChatProfile';
import { useChatScreenState } from '../../hooks/useChatScreenState';
import { useChatKeyboard } from '../../hooks/useChatKeyboard';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useScreenFont } from '../../utils/fontSetup';
import { useTranslation } from '../../src/i18n';

import { ChatScreenLayout } from '../../components/chat/ChatScreenLayout';
import { ChatHeader } from '../../components/chat/ChatHeader';
import { ChatWelcomeView } from '../../components/chat/ChatWelcomeView';
import { ChatMessageList } from '../../components/chat/ChatMessageList';
import { ChatComposerDock } from '../../components/chat/ChatComposerDock';
import { ChatHistoryPanel } from '../../components/chat/ChatHistoryPanel';
import { Toast } from '../../components/chat/Toast';
import { chatSpacing } from '../../components/chat/chatTheme';

export default function ChatScreen() {
  useScreenFont();
  const { t } = useTranslation();
  const tChat = t.chat;
  const { isOnline } = useNetworkStatus();

  const { profileRef, profile, isFifaCardComplete } = useChatProfile();

  const greetingName =
    profile?.displayName?.trim() || tChat.welcomeGreetingFallback;

  const getSystemPromptSuffix = useCallback(
    () => buildProfileSystemPromptSuffix(profileRef.current, greetingName),
    [profileRef, greetingName],
  );

  const {
    messages,
    conversations,
    currentConversationId,
    inputValue,
    setInputValue,
    isLoading,
    isThinking,
    isRetrying,
    messagesRemaining,
    dailyMessageLimit,
    resetTime,
    error,
    streamingMessageId,
    sendMessage,
    retryLastMessage,
    editMessage,
    deleteMessage,
    clearChat,
    dismissError,
    selectConversation,
    startNewConversation,
    togglePinConversation,
    renameConversation,
    deleteConversation,
  } = useAIChatNative({ getSystemPromptSuffix });

  const screen = useChatScreenState({
    messages,
    streamingMessageId,
    inputValue,
    setInputValue,
    sendMessage,
    editMessage,
    deleteMessage,
    retryLastMessage,
    dismissError,
    isOnline,
    profile,
    isFifaCardComplete,
    tChat: {
      backOnline: tChat.backOnline,
      offline: tChat.offline,
      profileNudge: tChat.profileNudge,
      connectionLost: tChat.connectionLost,
      retryButton: tChat.retryButton,
    },
  });

  const keyboard = useChatKeyboard({
    listRef: screen.listRef,
    hasMessages: screen.hasMessages,
    messageCount: messages.length,
  });

  const listBottomInset = chatSpacing.listBottom;

  const messageArea = screen.hasMessages ? (
    <ChatMessageList
      listRef={screen.listRef}
      displayMessages={screen.displayMessages}
      messages={messages}
      streamingMessageId={streamingMessageId}
      isThinking={isThinking}
      isRetrying={isRetrying}
      isLoading={isLoading}
      error={error}
      showScrollButton={screen.showScrollButton}
      unreadCount={screen.unreadCount}
      nudgeText={screen.nudgeText}
      onDismissNudge={() => screen.setNudgeText(null)}
      onScroll={screen.handleScroll}
      onScrollToBottom={screen.handleScrollToBottom}
      onRetry={() => {
        dismissError();
        retryLastMessage();
      }}
      onDismissError={dismissError}
      retryLabel={tChat.retryButton}
      connectionLostLabel={tChat.connectionLost}
      renderMessageHandlers={screen.renderMessageHandlers}
      isNearBottomRef={screen.isNearBottomRef}
      useNativeKeyboardScroll={keyboard.useNativeKeyboardScroll}
      keyboardVisible={keyboard.keyboardVisible}
      listBottomInset={listBottomInset}
    />
  ) : (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ChatWelcomeView greetingName={greetingName} tChat={tChat} />
    </View>
  );

  const connToast = screen.connToast ? (
    <Toast
      message={screen.connToast.message}
      type={screen.connToast.type}
      onClose={() => screen.setConnToast(null)}
      duration={3000}
    />
  ) : null;

  return (
    <ChatScreenLayout
      useKeyboardAvoiding={keyboard.useKeyboardAvoiding}
      connToast={connToast}
      header={
        <ChatHeader
          onBack={screen.handleBackHome}
          onMenu={screen.handleOpenPanel}
          backLabel={tChat.a11yBack}
          menuLabel={tChat.a11yMenu}
        />
      }
      historyPanel={
        <ChatHistoryPanel
          isOpen={screen.isPanelOpen}
          onClose={() => screen.setIsPanelOpen(false)}
          messagesRemaining={messagesRemaining}
          dailyMessageLimit={dailyMessageLimit}
          resetTime={resetTime}
          conversations={conversations}
          activeConversationId={currentConversationId}
          onSelectConversation={async (id) => {
            await selectConversation(id);
            screen.setIsPanelOpen(false);
            screen.scrollToEndAfterConversationChange();
          }}
          onTogglePin={togglePinConversation}
          onRenameConversation={renameConversation}
          onDeleteConversation={deleteConversation}
          onNewChat={async () => {
            clearChat();
            await startNewConversation();
            screen.setIsPanelOpen(false);
          }}
          isOnline={isOnline}
          isLoading={isLoading}
          displayName={profile?.displayName ?? null}
          avatar={profile?.avatar ?? null}
        />
      }
      messageArea={messageArea}
      composer={
        <ChatComposerDock
          dockPaddingBottom={keyboard.composerDockPadding}
          keyboardLift={keyboard.composerKeyboardLift}
          inputRef={screen.inputRef}
          value={inputValue}
          onChangeText={(text) => {
            setInputValue(text);
            keyboard.syncKeyboardHeight();
          }}
          onSend={() => screen.handleSend()}
          onInputFocus={keyboard.onInputFocus}
          placeholder={tChat.inputPlaceholder}
          editPlaceholder={tChat.inputPlaceholderEdit}
          editingMessage={screen.editingMessage}
          onCancelEdit={screen.handleCancelEdit}
          editingLabel={tChat.editingMessage}
          isLoading={isLoading}
          messagesRemaining={messagesRemaining}
          resetTime={resetTime}
          dailyLimitOverText={tChat.dailyLimitOver}
        />
      }
    />
  );
}
