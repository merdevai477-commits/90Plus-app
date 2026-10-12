/**
 * ChatComposer — compact floating water-glass capsule. The mic collapses the
 * capsule into a voice orb that reacts to the user's voice, then drops the
 * transcript into the field; the send bubble fades in once there is something
 * to send.
 */

import React, { useEffect, useMemo, useRef } from 'react';
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
  withTiming,
  withDelay,
  useAnimatedStyle,
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { Check, Mic, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { ChatSpinner } from './ChatSpinner';
import { LimitReachedCountdown } from './LimitReachedCountdown';
import { LiquidWaterSurface } from './LiquidWaterSurface';
import { IridescentRim } from './IridescentRim';
import { ChatRimButton } from './ChatRimButton';
import { VoiceOrb } from './VoiceOrb';
import { useVoiceModeStore, VOICE_PULL_MS } from './voiceModeStore';
import { Colors } from '../../constants/theme';
import { getTextDirectionStyles } from './chatTextUtils';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { useVoiceInput, type VoiceInputError } from '../../hooks/useVoiceInput';
import { GLASS_ACCENT } from '../navigation/glass';
import { GLASS_ICON_IDLE } from '../navigation/GlassCapsuleNav';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Composer size: capsule height (also the send button size) and side gap to the screen edges. */
const BAR_HEIGHT = 55;
const BAR_SIDE_INSET = 55;
const INPUT_FONT_SIZE = 14;
const BAR_RADIUS = BAR_HEIGHT / 1;
const BAR_PAD = 5;
const SLOT = BAR_HEIGHT - BAR_PAD * 2;
const BAR_TINT = 'rgba(20,12,40,0.42)';
/** Message field + send button: the welcome bubble's black core; IridescentRim adds its film edge. */
const FIELD_TINT = 'rgba(3,2,8,0.94)';
const FIELD_CAUSTIC: [number, number, number] = [0.6, 0.75, 1];
/** Voice mode: the capsule collapses to a BAR_HEIGHT circle and the orb floats over it. */
const ORB_SIZE = Math.round(BAR_HEIGHT * 1.3);
const VOICE_ACTION_SIZE = 44;
const VOICE_MORPH = LinearTransition.duration(340).easing(Easing.out(Easing.cubic));
/**
 * With the welcome bubble on screen, the voice orb fades in under it as it lands. The bubble
 * starts a couple of frames after this view (it waits on two layout measurements).
 */
const ORB_APPEAR_AFTER_PULL = VOICE_PULL_MS + 220;
const ORB_APPEAR_DELAY = 200;

function usePressScale(to: number) {
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return {
    style,
    onPressIn: () => { press.value = withTiming(to, { duration: 90 }); },
    onPressOut: () => { press.value = withTiming(1, { duration: 140 }); },
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
  const press = usePressScale(0.94);

  return (
    <AnimatedPressable
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
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
        tint={FIELD_TINT}
        glow={FIELD_CAUSTIC}
        strength={0.14}
        sheen={0.12}
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
      <IridescentRim radius={BAR_RADIUS} />
    </AnimatedPressable>
  );
}

function RoundIconButton({
  onPress,
  a11yLabel,
  children,
}: {
  onPress?: () => void;
  a11yLabel: string;
  children: React.ReactNode;
}) {
  const press = usePressScale(0.86);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={6}
      style={[styles.iconButton, styles.iconButtonGlass, press.style]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      {children}
    </AnimatedPressable>
  );
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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
  /** Full-width row shown above the capsule (e.g. suggestion chips); hidden in voice mode and while editing. */
  suggestions?: React.ReactNode;
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
  suggestions,
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
  const surfaceFade = useSharedValue(1);
  const surfaceStyle = useAnimatedStyle(() => ({ opacity: surfaceFade.value }));

  const rowRef = useRef<View>(null);
  const enterVoiceMode = useVoiceModeStore((s) => s.enter);
  const exitVoiceMode = useVoiceModeStore((s) => s.exit);
  const welcomeShown = useVoiceModeStore((s) => s.welcomeShown);
  const orbDelay = welcomeShown ? ORB_APPEAR_AFTER_PULL : ORB_APPEAR_DELAY;

  useEffect(() => {
    surfaceFade.value = voiceActive
      ? withDelay(160, withTiming(0, { duration: 260 }))
      : withTiming(1, { duration: 200 });
    if (voiceActive) {
      rowRef.current?.measureInWindow((_x, y, _w, h) => enterVoiceMode(y + h / 2, ORB_SIZE));
    } else {
      exitVoiceMode();
    }
  }, [voiceActive, surfaceFade, enterVoiceMode, exitVoiceMode]);

  useEffect(() => exitVoiceMode, [exitVoiceMode]);

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

          {suggestions && !voiceActive && !editingMessage ? (
            <Animated.View exiting={FadeOut.duration(180)} style={styles.suggestions}>
              {suggestions}
            </Animated.View>
          ) : null}

          <View
            ref={rowRef}
            collapsable={false}
            // Voice mode keeps cancel on the left and done on the right in both languages.
            style={[styles.composerRow, voiceActive ? styles.composerRowVoice : isAr && styles.rowRtl]}
          >
            {voice.status === 'recording' ? (
              <Animated.View entering={FadeIn.delay(orbDelay).duration(220)} exiting={FadeOut.duration(120)}>
                <ChatRimButton size={VOICE_ACTION_SIZE} onPress={voice.cancel} accessibilityLabel={t.chat.a11yVoiceCancel}>
                  <X size={18} color="#FFFFFF" strokeWidth={2.2} />
                </ChatRimButton>
              </Animated.View>
            ) : null}

            <Animated.View
              layout={VOICE_MORPH}
              style={voiceActive ? styles.orbWrap : styles.barWrap}
            >
              <Animated.View style={surfaceStyle}>
                <LiquidWaterSurface
                  radius={BAR_RADIUS}
                  tint={FIELD_TINT}
                  glow={FIELD_CAUSTIC}
                  strength={0.14}
                  sheen={0.12}
                  blurTarget={blurTarget}
                >
                  {voiceActive ? (
                    <View style={styles.barCollapsed} />
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
                <IridescentRim radius={BAR_RADIUS} focus={focus} />
              </Animated.View>

              {voiceActive ? (
                <Animated.View
                  entering={FadeIn.delay(orbDelay).duration(280)}
                  exiting={FadeOut.duration(160)}
                  pointerEvents="none"
                  style={styles.orb}
                  accessibilityLabel={
                    voice.status === 'transcribing' ? t.chat.voiceTranscribing : t.chat.a11yMic
                  }
                >
                  <VoiceOrb
                    size={ORB_SIZE}
                    level={voice.levels[voice.levels.length - 1] ?? 0}
                    mode={voice.status === 'transcribing' ? 'thinking' : 'listening'}
                    label={voice.status === 'recording' ? formatDuration(voice.durationMs) : undefined}
                  />
                </Animated.View>
              ) : null}
            </Animated.View>

            {voice.status === 'recording' ? (
              <Animated.View entering={FadeIn.delay(orbDelay).duration(220)} exiting={FadeOut.duration(120)}>
                <ChatRimButton size={VOICE_ACTION_SIZE} onPress={voice.finish} accessibilityLabel={t.chat.a11yVoiceDone}>
                  <Check size={19} color="#FFFFFF" strokeWidth={2.6} />
                </ChatRimButton>
              </Animated.View>
            ) : null}

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
    paddingHorizontal: BAR_SIDE_INSET,
  },
  suggestions: {
    marginHorizontal: -BAR_SIDE_INSET,
    marginBottom: 4,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  composerRowVoice: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
  },
  barWrap: {
    flex: 1,
  },
  orbWrap: {
    width: BAR_HEIGHT,
    height: BAR_HEIGHT,
  },
  barCollapsed: {
    height: BAR_HEIGHT,
  },
  orb: {
    position: 'absolute',
    left: (BAR_HEIGHT - ORB_SIZE) / 2,
    top: (BAR_HEIGHT - ORB_SIZE) / 2,
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
  textInput: {
    flex: 1,
    minHeight: SLOT,
    maxHeight: 140,
    color: '#FFFFFF',
    fontSize: INPUT_FONT_SIZE,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
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
