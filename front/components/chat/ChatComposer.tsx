/**
 * ChatComposer — fixed bottom input bar (outside FlatList).
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { ChatSpinner } from './ChatSpinner';
import { ChatGlassSurface } from './ChatGlassSurface';
import { LimitReachedCountdown } from './LimitReachedCountdown';
import { Colors, Gradients } from '../../constants/theme';
import { getTextDirectionStyles } from './chatTextUtils';
import { useTranslation } from '../../src/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SendButton({
  active,
  loading,
  isStop,
  onPress,
  a11yLabel,
}: {
  active: boolean;
  loading: boolean;
  isStop?: boolean;
  onPress: () => void;
  a11yLabel: string;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isStop ? false : !active || loading}
      style={style}
      onPressIn={() => { scale.value = withSpring(0.9, { stiffness: 300, damping: 18 }); }}
      onPressOut={() => { scale.value = withSpring(1, { stiffness: 300, damping: 18 }); }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <View style={[styles.sendButton, (active || isStop) && styles.sendButtonActive]}>
        {active && !isStop && (
          <LinearGradient
            colors={Gradients.purpleCTA}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {loading && !isStop ? (
          <ChatSpinner />
        ) : isStop ? (
          <View style={styles.stopSquare} />
        ) : (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
            <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
    </AnimatedPressable>
  );
}

export interface ChatComposerProps {
  inputRef: React.RefObject<TextInput | null>;
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  editPlaceholder: string;
  editingMessage: { id: string; text: string } | null;
  onCancelEdit: () => void;
  editingLabel: string;
  isLoading: boolean;
  messagesRemaining: number | null;
  resetTime: Date | null;
  dailyLimitOverText: string;
  limitResetsAfterText: string;
  stopLabel: string;
  /** Safe-area padding when KeyboardStickyView is not active (Expo Go). */
  bottomInset?: number;
  onInputFocus?: () => void;
  onStop?: () => void;
}

export function ChatComposer({
  inputRef,
  value,
  onChangeText,
  onSend,
  placeholder,
  editPlaceholder,
  editingMessage,
  onCancelEdit,
  editingLabel,
  isLoading,
  messagesRemaining,
  resetTime,
  dailyLimitOverText,
  limitResetsAfterText,
  stopLabel,
  bottomInset = 0,
  onInputFocus,
  onStop,
}: ChatComposerProps) {
  const { t } = useTranslation();
  const inputDirection = useMemo(() => getTextDirectionStyles(value), [value]);
  const isGenerating = isLoading && !!onStop;

  return (
    <View style={[styles.dock, bottomInset > 0 && { paddingBottom: bottomInset }]}>
      {messagesRemaining !== null && messagesRemaining <= 0 && resetTime ? (
        <View style={styles.limitBanner}>
          <Text style={styles.limitText}>{dailyLimitOverText}</Text>
          <Text style={styles.limitSub}>{limitResetsAfterText}</Text>
          <LimitReachedCountdown resetTime={resetTime} style={styles.limitCountdown} />
        </View>
      ) : (
        <ChatGlassSurface
          style={styles.inputWrapper}
          tint="rgba(16,10,28,0.92)"
          effect="regular"
          interactive={false}
        >
          <LinearGradient
            colors={['rgba(124,58,237,0.08)', 'rgba(76,29,149,0.04)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {editingMessage && (
            <Animated.View entering={FadeIn.duration(180)} style={styles.editHeader}>
              <View style={styles.editLabel}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.purpleSoft} strokeWidth={2}>
                  <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </Svg>
                <Text style={styles.editText}>{editingLabel}</Text>
              </View>
              <Pressable onPress={onCancelEdit} hitSlop={8}>
                <Text style={styles.editCancel}>×</Text>
              </Pressable>
            </Animated.View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={[styles.textInput, inputDirection]}
              value={value}
              onChangeText={onChangeText}
              onFocus={onInputFocus}
              placeholder={editingMessage ? editPlaceholder : placeholder}
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              onSubmitEditing={onSend}
              submitBehavior="submit"
              underlineColorAndroid="transparent"
              selectionColor={Colors.purpleSoft}
              blurOnSubmit={false}
            />
            <SendButton
              active={Boolean(value.trim())}
              loading={isLoading && !isGenerating}
              isStop={isGenerating}
              onPress={isGenerating ? onStop! : onSend}
              a11yLabel={isGenerating ? t.chat.a11yStop : t.chat.a11ySend}
            />
          </View>
        </ChatGlassSurface>
      )}

      <View style={styles.footerInfo}>
        <Text style={styles.footerText}>{t.chat.poweredBy}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: Colors.bgBase,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  inputWrapper: {
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 52,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    alignSelf: 'stretch',
    color: 'white',
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 10,
    maxHeight: 120,
    includeFontPadding: false,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  sendButtonActive: {
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(124,58,237,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editText: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  editCancel: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.6)',
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  footerInfo: { alignItems: 'center', marginTop: 8 },
  footerText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.22)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  limitBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 6,
  },
  limitText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  limitSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  limitCountdown: {
    fontSize: 28,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2,
    marginTop: 4,
  },
  stopSquare: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
});
