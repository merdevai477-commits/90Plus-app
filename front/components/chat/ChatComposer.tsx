/**
 * ChatComposer — floating liquid-glass input island with an inline mic and a
 * send button that springs in beside the field once the user starts typing.
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
  withTiming,
  useAnimatedStyle,
  interpolateColor,
  FadeIn,
  ZoomIn,
  ZoomOut,
  LinearTransition,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { ChatSpinner } from './ChatSpinner';
import { ChatGlassSurface } from './ChatGlassSurface';
import { LimitReachedCountdown } from './LimitReachedCountdown';
import { Colors, Gradients } from '../../constants/theme';
import { chatColors } from './chatTheme';
import { getTextDirectionStyles } from './chatTextUtils';
import { useTranslation } from '../../src/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ISLAND_HEIGHT = 54;
const PRESS_SPRING = { stiffness: 300, damping: 18 };
const ISLAND_TINT = Platform.OS === 'ios' ? 'rgba(22,12,40,0.45)' : 'rgba(22,12,40,0.82)';

function SendButton({
  loading,
  isStop,
  onPress,
  a11yLabel,
}: {
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
      entering={ZoomIn.springify().damping(14).stiffness(220)}
      exiting={ZoomOut.duration(140)}
      onPress={onPress}
      disabled={!isStop && loading}
      style={[styles.sendShadow, style]}
      onPressIn={() => { scale.value = withSpring(0.9, PRESS_SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, PRESS_SPRING); }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.sendButton}>
        <LinearGradient
          colors={isStop ? ['#4B5563', '#1F2937'] : Gradients.purpleCTA}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.sendSheen} />
        {loading && !isStop ? (
          <ChatSpinner />
        ) : isStop ? (
          <View style={styles.stopSquare} />
        ) : (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
            <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
    </AnimatedPressable>
  );
}

function MicButton({ onPress, a11yLabel }: { onPress?: () => void; a11yLabel: string }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.86, PRESS_SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, PRESS_SPRING); }}
      hitSlop={6}
      style={[styles.micButton, style]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <Mic size={19} color={chatColors.accentSoft} strokeWidth={2.2} />
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
  onMicPress?: () => void;
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
  onMicPress,
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
  const hasText = Boolean(value.trim());
  const showSend = hasText || isLoading;

  const focus = useSharedValue(0);
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      ['rgba(196,181,253,0.18)', 'rgba(192,132,252,0.6)'],
    ),
  }));

  const handleFocus = () => {
    focus.value = withTiming(1, { duration: 180 });
    onInputFocus?.();
  };
  const handleBlur = () => {
    focus.value = withTiming(0, { duration: 220 });
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dock, bottomInset > 0 && { paddingBottom: bottomInset }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(5,2,8,0)', 'rgba(5,2,8,0.7)', 'rgba(5,2,8,0.92)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {messagesRemaining !== null && messagesRemaining <= 0 && resetTime ? (
        <ChatGlassSurface style={styles.limitBanner} tint={ISLAND_TINT}>
          <Text style={styles.limitText}>{dailyLimitOverText}</Text>
          <Text style={styles.limitSub}>{limitResetsAfterText}</Text>
          <LimitReachedCountdown resetTime={resetTime} style={styles.limitCountdown} />
        </ChatGlassSurface>
      ) : (
        <>
          {editingMessage ? (
            <Animated.View entering={FadeIn.duration(180)}>
              <ChatGlassSurface style={styles.editHeader} tint="rgba(124,58,237,0.22)">
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
              </ChatGlassSurface>
            </Animated.View>
          ) : null}

          <View style={[styles.composerRow, isAr && styles.composerRowRtl]}>
            <Animated.View
              layout={LinearTransition.springify().damping(18).stiffness(200)}
              style={styles.islandShadow}
            >
              <ChatGlassSurface
                style={[styles.island, isAr && styles.islandRtl]}
                tint={ISLAND_TINT}
                effect="regular"
                interactive
              >
                <Animated.View pointerEvents="none" style={[styles.islandRing, ringStyle]} />
                <TextInput
                  ref={inputRef}
                  style={[styles.textInput, inputDirection]}
                  value={value}
                  onChangeText={onChangeText}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder={editingMessage ? editPlaceholder : placeholder}
                  placeholderTextColor="rgba(255,255,255,0.38)"
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
                <MicButton onPress={onMicPress} a11yLabel={t.chat.a11yMic} />
              </ChatGlassSurface>
            </Animated.View>

            {showSend ? (
              <SendButton
                loading={isLoading && !isGenerating}
                isStop={isGenerating}
                onPress={isGenerating ? onStop! : onSend}
                a11yLabel={isGenerating ? t.chat.a11yStop : t.chat.a11ySend}
              />
            ) : null}
          </View>
        </>
      )}

      {keyboardVisible ? null : (
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>{t.chat.poweredBy}</Text>
        </View>
      )}
    </View>
  );
}

const glow = Platform.select({
  ios: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  default: {},
});

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 8,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  composerRowRtl: {
    flexDirection: 'row-reverse',
  },
  islandShadow: {
    flex: 1,
    borderRadius: ISLAND_HEIGHT / 2,
    ...glow,
  },
  island: {
    minHeight: ISLAND_HEIGHT,
    borderRadius: ISLAND_HEIGHT / 2,
    paddingLeft: 20,
    paddingRight: 7,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  islandRtl: {
    flexDirection: 'row-reverse',
    paddingLeft: 7,
    paddingRight: 20,
  },
  islandRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ISLAND_HEIGHT / 2,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    minHeight: ISLAND_HEIGHT - 14,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    maxHeight: 120,
    includeFontPadding: false,
  },
  micButton: {
    width: ISLAND_HEIGHT - 14,
    height: ISLAND_HEIGHT - 14,
    borderRadius: (ISLAND_HEIGHT - 14) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,181,253,0.28)',
  },
  sendShadow: {
    borderRadius: ISLAND_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 14,
      },
      android: { elevation: 8 },
    }),
  },
  sendButton: {
    width: ISLAND_HEIGHT,
    height: ISLAND_HEIGHT,
    borderRadius: ISLAND_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sendSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ISLAND_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.35)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,181,253,0.2)',
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
