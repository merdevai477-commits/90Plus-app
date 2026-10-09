/**
 * ChatComposer — floating capsule built from the bottom nav's glass material,
 * with an inline mic and a lit send bubble that springs in once the user types.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedStyle,
  FadeIn,
  ZoomIn,
  ZoomOut,
  LinearTransition,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { ChatSpinner } from './ChatSpinner';
import { LimitReachedCountdown } from './LimitReachedCountdown';
import { Colors } from '../../constants/theme';
import { getTextDirectionStyles } from './chatTextUtils';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import {
  GLASS_ACCENT,
  GLASS_BAR_BG,
  GlassBubbleFill,
  GlassRim,
  GlassSheen,
} from '../navigation/glass';
import { GLASS_ICON_IDLE } from '../navigation/GlassCapsuleNav';
import { TAB_BAR_HEIGHT, TAB_BAR_HORIZONTAL_MARGIN } from '../navigation/liquidGlassTabBar.constants';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const BAR_HEIGHT = TAB_BAR_HEIGHT;
const BAR_RADIUS = BAR_HEIGHT / 2;
const BAR_PAD = 6;
const SLOT = BAR_HEIGHT - BAR_PAD * 2;
const SPRING = { damping: 18, stiffness: 210, mass: 0.9 };

function GlassPanel({
  radius,
  style,
  children,
}: {
  radius: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.panel, { borderRadius: radius }, style]}>
      <GlassSheen radius={radius} />
      <GlassRim radius={radius} />
      {children}
    </View>
  );
}

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
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <AnimatedPressable
      entering={ZoomIn.springify().damping(15).stiffness(240)}
      exiting={ZoomOut.duration(140)}
      onPress={onPress}
      disabled={!isStop && loading}
      onPressIn={() => { press.value = withSpring(0.9, SPRING); }}
      onPressOut={() => { press.value = withSpring(1, SPRING); }}
      style={[styles.sendButton, style]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      {isStop ? (
        <View style={[StyleSheet.absoluteFill, styles.stopFill]}>
          <LinearGradient colors={['#4B5563', '#1F2937']} style={StyleSheet.absoluteFill} />
          <GlassRim radius={BAR_RADIUS} />
        </View>
      ) : (
        <GlassBubbleFill radius={BAR_RADIUS} height={BAR_HEIGHT} />
      )}
      {loading && !isStop ? (
        <ChatSpinner />
      ) : isStop ? (
        <View style={styles.stopSquare} />
      ) : (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
          <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </AnimatedPressable>
  );
}

function MicButton({ onPress, a11yLabel }: { onPress?: () => void; a11yLabel: string }) {
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { press.value = withSpring(0.88, SPRING); }}
      onPressOut={() => { press.value = withSpring(1, SPRING); }}
      hitSlop={6}
      style={[styles.micButton, style]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <GlassSheen radius={SLOT / 2} intensity={0.8} />
      <Mic size={20} color={GLASS_ICON_IDLE} strokeWidth={2} />
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
  /** Gap below the capsule; matches the bottom nav's float height when the keyboard is closed. */
  bottomInset?: number;
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
  keyboardVisible: _keyboardVisible,
  onInputFocus,
  onStop,
  onMicPress,
}: ChatComposerProps) {
  const { t, language } = useTranslation();
  const fontMedium = useAppFont(500);
  const isAr = language === 'ar';
  const inputDirection = useMemo(() => {
    if (value.trim()) return getTextDirectionStyles(value);
    return isAr
      ? { textAlign: 'right' as const, writingDirection: 'rtl' as const }
      : { textAlign: 'left' as const, writingDirection: 'ltr' as const };
  }, [value, isAr]);
  const isGenerating = isLoading && !!onStop;
  const showSend = Boolean(value.trim()) || isLoading;

  const focus = useSharedValue(0);
  const focusRimStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  const handleFocus = () => {
    focus.value = withTiming(1, { duration: 180 });
    onInputFocus?.();
  };
  const handleBlur = () => {
    focus.value = withTiming(0, { duration: 220 });
  };

  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: bottomInset }]}>
      {messagesRemaining !== null && messagesRemaining <= 0 && resetTime ? (
        <GlassPanel radius={26} style={styles.limitBanner}>
          <Text style={styles.limitText}>{dailyLimitOverText}</Text>
          <Text style={styles.limitSub}>{limitResetsAfterText}</Text>
          <LimitReachedCountdown resetTime={resetTime} style={styles.limitCountdown} />
        </GlassPanel>
      ) : (
        <>
          {editingMessage ? (
            <Animated.View entering={FadeIn.duration(180)}>
              <GlassPanel radius={18} style={styles.editHeader}>
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
              </GlassPanel>
            </Animated.View>
          ) : null}

          <View style={[styles.composerRow, isAr && styles.rowRtl]}>
            <Animated.View
              layout={LinearTransition.springify().damping(18).stiffness(210)}
              style={styles.barWrap}
            >
              <GlassPanel radius={BAR_RADIUS} style={[styles.bar, isAr && styles.barRtl]}>
                <Animated.View pointerEvents="none" style={[styles.focusRim, focusRimStyle]} />
                <TextInput
                  ref={inputRef}
                  style={[styles.textInput, { fontFamily: fontMedium }, inputDirection]}
                  value={value}
                  onChangeText={onChangeText}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder={editingMessage ? editPlaceholder : placeholder}
                  placeholderTextColor="rgba(235,228,255,0.42)"
                  multiline
                  textAlignVertical="center"
                  keyboardAppearance="dark"
                  returnKeyType="send"
                  onSubmitEditing={onSend}
                  submitBehavior="submit"
                  underlineColorAndroid="transparent"
                  selectionColor={GLASS_ACCENT}
                  cursorColor={GLASS_ACCENT}
                  blurOnSubmit={false}
                  maxFontSizeMultiplier={1.2}
                />
                <MicButton onPress={onMicPress} a11yLabel={t.chat.a11yMic} />
              </GlassPanel>
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
    </View>
  );
}

const barShadow = {
  shadowColor: '#7C4DFF',
  shadowOpacity: 0.45,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 12,
};

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: TAB_BAR_HORIZONTAL_MARGIN,
  },
  panel: {
    backgroundColor: GLASS_BAR_BG,
    ...barShadow,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  barWrap: {
    flex: 1,
  },
  bar: {
    minHeight: BAR_HEIGHT,
    paddingVertical: BAR_PAD,
    paddingLeft: 20,
    paddingRight: BAR_PAD,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  barRtl: {
    flexDirection: 'row-reverse',
    paddingLeft: BAR_PAD,
    paddingRight: 20,
  },
  focusRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(164,123,255,0.65)',
    borderTopColor: 'rgba(255,255,255,0.55)',
  },
  textInput: {
    flex: 1,
    minHeight: SLOT,
    maxHeight: 120,
    color: '#FFFFFF',
    fontSize: 15,
    paddingTop: Platform.OS === 'ios' ? 13 : 10,
    paddingBottom: Platform.OS === 'ios' ? 13 : 10,
    includeFontPadding: false,
  },
  micButton: {
    width: SLOT,
    height: SLOT,
    borderRadius: SLOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(190,160,255,0.25)',
  },
  sendButton: {
    width: BAR_HEIGHT,
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  stopFill: {
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 10,
  },
  editLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  editCancel: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.6)',
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  limitBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 6,
  },
  limitText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  limitSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  limitCountdown: {
    fontSize: 28,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
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
