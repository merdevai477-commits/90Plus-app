/**
 * ChatComposer — compact floating water-glass capsule. The mic records a voice
 * question and drops the transcript into the field; the glass send bubble
 * springs in beside the capsule once there is something to send.
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  useAnimatedStyle,
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  LinearTransition,
} from 'react-native-reanimated';
import { Check, Mic, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { ChatSpinner } from './ChatSpinner';
import { LimitReachedCountdown } from './LimitReachedCountdown';
import { LiquidWaterSurface } from './LiquidWaterSurface';
import { Colors } from '../../constants/theme';
import { getTextDirectionStyles } from './chatTextUtils';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { useVoiceInput, type VoiceInputError } from '../../hooks/useVoiceInput';
import { GLASS_ACCENT, GlassBubbleFill } from '../navigation/glass';
import { GLASS_ICON_IDLE } from '../navigation/GlassCapsuleNav';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const BAR_HEIGHT = 50;
const BAR_RADIUS = BAR_HEIGHT / 2;
const BAR_PAD = 5;
const SLOT = BAR_HEIGHT - BAR_PAD * 2;
const SPRING = { damping: 18, stiffness: 210, mass: 0.9 };
const BAR_TINT = 'rgba(20,12,40,0.42)';
const SEND_TINT = 'rgba(124,77,255,0.5)';

function usePressScale(to: number) {
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return {
    style,
    onPressIn: () => { press.value = withSpring(to, SPRING); },
    onPressOut: () => { press.value = withSpring(1, SPRING); },
  };
}

function SendButton({
  loading,
  isStop,
  onPress,
  a11yLabel,
  blurTarget,
}: {
  loading: boolean;
  isStop?: boolean;
  onPress: () => void;
  a11yLabel: string;
  blurTarget?: React.RefObject<View | null>;
}) {
  const press = usePressScale(0.88);

  return (
    <AnimatedPressable
      entering={ZoomIn.springify().damping(15).stiffness(240)}
      exiting={ZoomOut.duration(140)}
      onPress={onPress}
      disabled={!isStop && loading}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={press.style}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <LiquidWaterSurface
        radius={BAR_RADIUS}
        tint={isStop ? 'rgba(75,85,99,0.55)' : SEND_TINT}
        glow={[1, 1, 1]}
        strength={0.5}
        scale={1.1}
        blurTarget={blurTarget}
        style={styles.sendButton}
      >
        {loading && !isStop ? (
          <ChatSpinner />
        ) : isStop ? (
          <View style={styles.stopSquare} />
        ) : (
          <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.3}>
            <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </LiquidWaterSurface>
    </AnimatedPressable>
  );
}

function RoundIconButton({
  onPress,
  a11yLabel,
  variant = 'glass',
  children,
}: {
  onPress?: () => void;
  a11yLabel: string;
  variant?: 'glass' | 'lit';
  children: React.ReactNode;
}) {
  const press = usePressScale(0.86);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={6}
      style={[styles.iconButton, variant === 'glass' && styles.iconButtonGlass, press.style]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      {variant === 'lit' ? <GlassBubbleFill radius={SLOT / 2} height={SLOT} /> : null}
      {children}
    </AnimatedPressable>
  );
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function RecordingDot() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.25, { duration: 650 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.recDot, style]} />;
}

function LevelBars({ levels, rtl }: { levels: number[]; rtl: boolean }) {
  return (
    <View style={[styles.levels, rtl && styles.rowRtl]}>
      {levels.map((level, i) => (
        <View key={i} style={[styles.levelBar, { height: 3 + level * 20, opacity: 0.35 + level * 0.65 }]} />
      ))}
    </View>
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
  /** Gap below the capsule. */
  bottomInset?: number;
  keyboardVisible?: boolean;
  onInputFocus?: () => void;
  onStop?: () => void;
  onVoiceError?: (reason: VoiceInputError) => void;
  /** Android: the chat content view the glass frosts. */
  blurTarget?: React.RefObject<View | null>;
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
  onVoiceError,
  blurTarget,
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

  const voice = useVoiceInput({
    onTranscript: (text) => {
      const current = value.trim();
      onChangeText(current ? `${current} ${text}` : text);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    onError: (reason) => onVoiceError?.(reason),
  });
  const voiceActive = voice.status !== 'idle';
  const showSend = !voiceActive && (Boolean(value.trim()) || isLoading);

  const focus = useSharedValue(0);
  const focusRimStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  const handleFocus = () => {
    focus.value = withTiming(1, { duration: 180 });
    onInputFocus?.();
  };
  const handleBlur = () => {
    focus.value = withTiming(0, { duration: 220 });
  };

  const limitReached = messagesRemaining !== null && messagesRemaining <= 0;

  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: bottomInset }]}>
      {limitReached && resetTime ? (
        <LiquidWaterSurface radius={24} tint={BAR_TINT} blurTarget={blurTarget} style={styles.limitBanner}>
          <Text style={styles.limitText}>{dailyLimitOverText}</Text>
          <Text style={styles.limitSub}>{limitResetsAfterText}</Text>
          <LimitReachedCountdown resetTime={resetTime} style={styles.limitCountdown} />
        </LiquidWaterSurface>
      ) : (
        <>
          {editingMessage ? (
            <Animated.View entering={FadeIn.duration(180)}>
              <LiquidWaterSurface radius={16} tint="rgba(124,58,237,0.3)" blurTarget={blurTarget} style={styles.editHeader}>
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
              </LiquidWaterSurface>
            </Animated.View>
          ) : null}

          <View style={[styles.composerRow, isAr && styles.rowRtl]}>
            <Animated.View
              layout={LinearTransition.springify().damping(18).stiffness(210)}
              style={styles.barWrap}
            >
              <LiquidWaterSurface radius={BAR_RADIUS} tint={BAR_TINT} blurTarget={blurTarget}>
                <Animated.View pointerEvents="none" style={[styles.focusRim, focusRimStyle]} />

                {voice.status === 'recording' ? (
                  <Animated.View
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(120)}
                    style={[styles.bar, styles.barVoice, isAr && styles.rowRtl]}
                  >
                    <RoundIconButton onPress={voice.cancel} a11yLabel={t.chat.a11yVoiceCancel}>
                      <X size={18} color={GLASS_ICON_IDLE} strokeWidth={2.2} />
                    </RoundIconButton>
                    <View style={[styles.recMeta, isAr && styles.rowRtl]}>
                      <RecordingDot />
                      <Text style={[styles.recTime, { fontFamily: fontMedium }]}>
                        {formatDuration(voice.durationMs)}
                      </Text>
                    </View>
                    <LevelBars levels={voice.levels} rtl={isAr} />
                    <RoundIconButton onPress={voice.finish} a11yLabel={t.chat.a11yVoiceDone} variant="lit">
                      <Check size={19} color="#FFFFFF" strokeWidth={2.6} />
                    </RoundIconButton>
                  </Animated.View>
                ) : voice.status === 'transcribing' ? (
                  <Animated.View
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(120)}
                    style={[styles.bar, styles.barVoice, styles.transcribing, isAr && styles.rowRtl]}
                  >
                    <ActivityIndicator size="small" color={GLASS_ACCENT} />
                    <Text style={[styles.transcribingText, { fontFamily: fontMedium }]}>
                      {t.chat.voiceTranscribing}
                    </Text>
                  </Animated.View>
                ) : (
                  <View style={[styles.bar, isAr && styles.barRtl]}>
                    <TextInput
                      ref={inputRef}
                      style={[styles.textInput, { fontFamily: fontMedium }, inputDirection]}
                      value={value}
                      onChangeText={onChangeText}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder={editingMessage ? editPlaceholder : placeholder}
                      placeholderTextColor="rgba(235,228,255,0.45)"
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
                    <RoundIconButton onPress={voice.start} a11yLabel={t.chat.a11yMic}>
                      <Mic size={18} color={GLASS_ICON_IDLE} strokeWidth={2} />
                    </RoundIconButton>
                  </View>
                )}
              </LiquidWaterSurface>
            </Animated.View>

            {showSend ? (
              <SendButton
                loading={isLoading && !isGenerating}
                isStop={isGenerating}
                onPress={isGenerating ? onStop! : onSend}
                a11yLabel={isGenerating ? t.chat.a11yStop : t.chat.a11ySend}
                blurTarget={blurTarget}
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: 22,
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
    paddingLeft: 18,
    paddingRight: BAR_PAD,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barRtl: {
    flexDirection: 'row-reverse',
    paddingLeft: BAR_PAD,
    paddingRight: 18,
  },
  barVoice: {
    alignItems: 'center',
    paddingLeft: BAR_PAD,
    gap: 10,
  },
  focusRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(164,123,255,0.7)',
    borderTopColor: 'rgba(255,255,255,0.6)',
  },
  textInput: {
    flex: 1,
    minHeight: SLOT,
    maxHeight: 140,
    color: '#FFFFFF',
    fontSize: 14.5,
    paddingTop: Platform.OS === 'ios' ? 11 : 9,
    paddingBottom: Platform.OS === 'ios' ? 11 : 9,
    includeFontPadding: false,
  },
  iconButton: {
    width: SLOT,
    height: SLOT,
    borderRadius: SLOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconButtonGlass: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(210,190,255,0.3)',
  },
  recMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F43F5E',
  },
  recTime: {
    color: '#FFFFFF',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  levels: {
    flex: 1,
    height: SLOT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  levelBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: '#C4B5FD',
  },
  transcribing: {
    justifyContent: 'center',
  },
  transcribingText: {
    color: 'rgba(235,228,255,0.8)',
    fontSize: 13.5,
  },
  sendButton: {
    width: BAR_HEIGHT,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 13,
    height: 13,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
});
