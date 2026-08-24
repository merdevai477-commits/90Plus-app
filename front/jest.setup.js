try {
  // Optional: RNTL ≥12.4 ships matchers; this package may be absent.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@testing-library/jest-native/extend-expect');
} catch {
  /* no-op when not installed */
}

// ── expo-router ────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useFocusEffect: jest.fn(),
  usePathname: jest.fn(() => '/'),
  useSegments: jest.fn(() => []),
  Stack: ({ children }) => children,
  Tabs: ({ children }) => children,
  Link: ({ children }) => children,
}));

// ── expo-haptics ───────────────────────────────────────────────────────────
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// ── expo-video (SDK 55, replaces expo-av) ──────────────────────────────────
jest.mock('expo-video', () => {
  const mockPlayer = () => {
    const listeners = new Map();
    return {
      // Properties
      playing: false,
      muted: false,
      loop: false,
      currentTime: 0,
      duration: 0,
      status: 'readyToPlay',
      timeUpdateEventInterval: 0,
      audioMixingMode: 'auto',
      // Methods
      play: jest.fn(),
      pause: jest.fn(),
      replay: jest.fn(),
      replace: jest.fn(),
      replaceAsync: jest.fn(async () => {}),
      seekBy: jest.fn(),
      release: jest.fn(),
      addListener: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
        return {
          remove: () => {
            listeners.get(event)?.delete(listener);
          },
        };
      }),
      removeListener: jest.fn(),
    };
  };

  return {
    useVideoPlayer: jest.fn((_source, setup) => {
      const p = mockPlayer();
      try {
        setup?.(p);
      } catch {
        /* ignore */
      }
      return p;
    }),
    createVideoPlayer: jest.fn(() => mockPlayer()),
    VideoView: ({ children }) => children ?? null,
  };
});

// ── expo-audio (SDK 55, replaces expo-av audio side) ───────────────────────
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    currentTime: 0,
    duration: 0,
    playing: false,
  })),
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    currentTime: 0,
    duration: 0,
    playing: false,
  })),
  AudioModule: {
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  },
  RecordingPresets: {
    HIGH_QUALITY: {},
    LOW_QUALITY: {},
  },
}));

// ── expo (useEvent / useEventListener live here) ───────────────────────────
jest.mock('expo', () => ({
  useEvent: jest.fn((_emitter, _event, initial) => initial ?? {}),
  useEventListener: jest.fn(),
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};
