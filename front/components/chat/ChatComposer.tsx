/**
 * ChatComposer — bottom input bar, visually aligned with match live chat.
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
import { Sparkles } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { ChatSpinner } from './ChatSpinner';
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
      onPressIn={() => { scale.value = withSpring(0.92, { stiffness: 300, damping: 18 }); }}
      onPressOut={() => { scale.value = withSpring(1, { stiffness: 300, damping: 18 }); }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <View style={[styles.sendButton, (active || isStop) && styles.sendButtonActive]}>
        {(active || isStop) && (
          <LinearGradient
            colors={isStop ? ['#4B5563', '#1F2937'] : Gradients.purpleCTA}
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
  /** Hides the footer so the field sits on the keyboard like live chat. */
  keyboardVisible?: boolean;
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
  stopLabel: _stopLabel,
  bottomInset = 0,
  keyboardVisible = false,
  onInputFocus,
  onStop,
}: ChatComposerProps) {
  const { t, language } = useTranslation();
  const isAr = language === 'ar';
  const inputDirection = useMemo(() => {
    if (value.trim()) return getTextDirectionStyles(value);
    return isAr
      ? { textAlign: 'right' as const, writingDirection: 'rtl' as const }
      : { textAlign: 'left' as const, writingDirection: 'ltr' as const };
  }, [value, isAr]);
  const isGenerating = isLoading && !!onStop;

  return (
    <LinearGradient
      colors={['#07040D', '#0C051A']}
      style={[styles.dock, bottomInset > 0 && { paddingBottom: bottomInset }]}
    >
      {messagesRemaining !== null && messagesRemaining <= 0 && resetTime ? (
        <View style={styles.limitBanner}>
          <Text style={styles.limitText}>{dailyLimitOverText}</Text>
          <Text style={styles.limitSub}>{limitResetsAfterText}</Text>
          <LimitReachedCountdown resetTime={resetTime} style={styles.limitCountdown} />
        </View>
      ) : (
        <>
          {editingMessage ? (
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
          ) : null}

          <View style={[styles.composerRow, isAr && styles.composerRowRtl]}>
            <View style={[styles.inputContainer, isAr && styles.inputContainerRtl]}>
              <Sparkles size={18} color="#6B6175" strokeWidth={2} />
              <TextInput
                ref={inputRef}
                style={[styles.textInput, inputDirection]}
                value={value}
                onChangeText={onChangeText}
                onFocus={onInputFocus}
                placeholder={editingMessage ? editPlaceholder : placeholder}
                placeholderTextColor="#484050"
                multiline
                textAlignVertical="center"
                keyboardAppearance="dark"
                returnKeyType="send"
                onSubmitEditing={onSend}
                submitBehavior="submit"
                underlineColorAndroid="transparent"
                selectionColor={Colors.purpleSoft}
                blurOnSubmit={false}
              />
            </View>
            <SendButton
              active={Boolean(value.trim())}
              loading={isLoading && !isGenerating}
              isStop={isGenerating}
              onPress={isGenerating ? onStop! : onSend}
              a11yLabel={isGenerating ? t.chat.a11yStop : t.chat.a11ySend}
            />
          </View>
        </>
      )}

      {keyboardVisible ? null : (
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>{t.chat.poweredBy}</Text>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#24193B',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  composerRowRtl: {
    flexDirection: 'row-reverse',
  },
  inputContainer: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07030D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E2933',
    gap: 10,
  },
  inputContainerRtl: {
    flexDirection: 'row-reverse',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    maxHeight: 120,
    includeFontPadding: false,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42,26,92,0.85)',
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124,58,237,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
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
