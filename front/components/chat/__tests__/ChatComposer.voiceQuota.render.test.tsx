/**
 * Mic ↔ "voice time used up" notice in the chat composer. Visual leaves
 * (glass, Skia, orb) are plain views; the composer's own logic is real.
 *
 *   npx jest -c jest.render.config.js components/chat/__tests__/ChatComposer.voiceQuota.render.test.tsx
 */

import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { TextInput } from 'react-native';

import { ar } from '../../../locales/ar';
import { en } from '../../../locales/en';
import type { VoiceQuotaUpdate } from '../../../hooks/voiceTranscribeResponse';

// Reanimated 4's bundled mock needs the native worklets runtime; the composer only needs these.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const builder: any = new Proxy({}, { get: () => () => builder });
  const Animated = { View, createAnimatedComponent: (c: unknown) => c };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    withDelay: (_d: number, v: unknown) => v,
    Easing: { out: () => undefined, cubic: undefined },
    FadeIn: builder,
    FadeOut: builder,
    LinearTransition: builder,
  };
});

jest.mock('../LiquidWaterSurface', () => {
  const { View } = jest.requireActual('react-native');
  return { LiquidWaterSurface: ({ children, style }: any) => <View style={style}>{children}</View> };
});
jest.mock('../IridescentRim', () => ({ IridescentRim: () => null }));
jest.mock('../VoiceOrb', () => ({ VoiceOrb: () => null }));
jest.mock('../ChatSpinner', () => ({ ChatSpinner: () => null }));
jest.mock('../ChatRimButton', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { ChatRimButton: ({ children, ...p }: any) => <Pressable {...p}>{children}</Pressable> };
});
jest.mock('../LimitReachedCountdown', () => {
  const { Text } = jest.requireActual('react-native');
  return { LimitReachedCountdown: () => <Text>countdown</Text> };
});
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  const Stub = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Stub, Path: Stub };
});
jest.mock('../../navigation/glass', () => ({ GLASS_ACCENT: '#a78bfa' }));
jest.mock('../../navigation/GlassCapsuleNav', () => ({ GLASS_ICON_IDLE: '#ffffff' }));
jest.mock('../../../constants/theme', () => ({ Colors: { purpleSoft: '#c4b5fd' } }));
jest.mock('../../../utils/fontSetup', () => ({ useAppFont: () => undefined }));

const mockLanguage = { current: 'ar' as 'ar' | 'en' };
jest.mock('../../../src/i18n', () => ({
  useTranslation: () => {
    const locales = { ar: jest.requireActual('../../../locales/ar').ar, en: jest.requireActual('../../../locales/en').en };
    return { t: locales[mockLanguage.current], language: mockLanguage.current };
  },
}));

/** Captures what the composer hands the recorder, so a server response can be replayed into it. */
const mockVoice = {
  options: null as null | {
    onQuota?: (q: VoiceQuotaUpdate) => void;
    onError: (reason: string) => void;
    canStart?: () => string | null;
    maxDurationMs?: number;
  },
  start: jest.fn(),
};
jest.mock('../../../hooks/useVoiceInput', () => ({
  useVoiceInput: (options: any) => {
    mockVoice.options = options;
    return {
      status: 'idle',
      durationMs: 0,
      levels: [0],
      start: mockVoice.start,
      finish: jest.fn(),
      cancel: jest.fn(),
    };
  },
}));

import { ChatComposer } from '../ChatComposer';

const HOUR = 60 * 60 * 1000;

function quota(remainingSeconds: number, resetAt: string | null = null): VoiceQuotaUpdate {
  return { remainingSeconds, limitSeconds: 150, resetAt };
}

/** Holds the voice quota in state the way the chat screen does, so server updates re-render. */
function Harness({
  initialQuota,
  messagesRemaining = 5,
  resetTime = null,
  onSend = jest.fn(),
}: {
  initialQuota: VoiceQuotaUpdate | null;
  messagesRemaining?: number | null;
  resetTime?: Date | null;
  onSend?: () => void;
}) {
  const [voiceQuota, setVoiceQuota] = useState(initialQuota);
  const [value, setValue] = useState('');
  return (
    <ChatComposer
      inputRef={React.createRef<TextInput>()}
      value={value}
      onChangeText={setValue}
      onSend={onSend}
      placeholder="placeholder"
      editPlaceholder="edit"
      editingMessage={null}
      onCancelEdit={jest.fn()}
      editingLabel="editing"
      isLoading={false}
      messagesRemaining={messagesRemaining}
      resetTime={resetTime}
      dailyLimitOverText="daily limit over"
      limitResetsAfterText="resets after"
      stopLabel="stop"
      voiceQuota={voiceQuota}
      onVoiceQuota={setVoiceQuota}
    />
  );
}

beforeEach(() => {
  mockLanguage.current = 'ar';
  mockVoice.options = null;
  mockVoice.start.mockClear();
});

describe('ChatComposer voice quota', () => {
  it('shows the mic with the time left while voice time is available', () => {
    render(<Harness initialQuota={quota(95)} />);
    expect(screen.getByTestId('chat-mic')).toBeTruthy();
    expect(screen.getByText('1:35')).toBeTruthy();
    expect(screen.queryByTestId('voice-quota-notice')).toBeNull();
    expect(mockVoice.options?.maxDurationMs).toBe(30_000);
  });

  it('caps the next recording at the time left when that is under 30s', () => {
    render(<Harness initialQuota={quota(12)} />);
    expect(mockVoice.options?.maxDurationMs).toBe(12_000);
  });

  it('shows the mic without a counter when the quota is unknown', () => {
    render(<Harness initialQuota={null} />);
    expect(screen.getByTestId('chat-mic')).toBeTruthy();
    expect(screen.queryByText(/^\d+:\d\d$/)).toBeNull();
  });

  it('replaces the mic with the notice at zero, leaving typing and sending working', () => {
    const onSend = jest.fn();
    const tomorrow = new Date(Date.now() + 20 * HOUR);
    tomorrow.setHours(12, 0, 0, 0);
    if (tomorrow.getTime() - Date.now() < 12 * HOUR) tomorrow.setDate(tomorrow.getDate() + 1);
    render(<Harness initialQuota={quota(0, tomorrow.toISOString())} onSend={onSend} />);

    expect(screen.queryByTestId('chat-mic')).toBeNull();
    expect(screen.getByText(ar.chat.voiceExhaustedTomorrow)).toBeTruthy();

    const input = screen.getByPlaceholderText('placeholder');
    fireEvent.changeText(input, 'مين هداف الدوري؟');
    expect(screen.getByDisplayValue('مين هداف الدوري؟')).toBeTruthy();
    fireEvent(input, 'submitEditing');
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('a server rejection swaps the mic for the notice immediately', () => {
    render(<Harness initialQuota={quota(20)} />);
    expect(screen.getByTestId('chat-mic')).toBeTruthy();

    act(() => {
      mockVoice.options?.onQuota?.(quota(0, null));
    });

    expect(screen.queryByTestId('chat-mic')).toBeNull();
    expect(screen.getByTestId('voice-quota-notice')).toBeTruthy();
    expect(screen.getByText(ar.chat.voiceExhaustedLater)).toBeTruthy();
    expect(mockVoice.options?.canStart?.()).toBe('voiceQuota');
  });

  it('an exhausted message quota keeps the existing limit banner and no mic', () => {
    render(<Harness initialQuota={quota(90)} messagesRemaining={0} resetTime={new Date(Date.now() + HOUR)} />);
    expect(screen.getByText('daily limit over')).toBeTruthy();
    expect(screen.queryByTestId('chat-mic')).toBeNull();
    expect(screen.queryByTestId('voice-quota-notice')).toBeNull();
  });

  it('an exhausted message quota without a reset time hides the mic but shows no voice notice', () => {
    render(<Harness initialQuota={quota(90)} messagesRemaining={0} />);
    expect(screen.queryByTestId('chat-mic')).toBeNull();
    expect(screen.queryByTestId('voice-quota-notice')).toBeNull();
    expect(mockVoice.options?.canStart?.()).toBe('messageQuota');
  });

  it('renders the English notice in English', () => {
    mockLanguage.current = 'en';
    render(<Harness initialQuota={quota(0, null)} />);
    expect(screen.getByText(en.chat.voiceExhaustedLater)).toBeTruthy();
  });
});
