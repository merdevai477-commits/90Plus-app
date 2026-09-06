import { AppState } from 'react-native';

import {
  confirmExternalShare,
  isCopyShareActivity,
  SHARE_HANDOFF_MS,
  watchShareHandoff,
} from '../confirmExternalShare';

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
  },
}));

const appState = AppState as unknown as {
  currentState: string;
  addEventListener: jest.Mock;
};

beforeEach(() => {
  appState.currentState = 'active';
  appState.addEventListener.mockReset();
});

describe('confirmExternalShare', () => {
  it('counts immediately when the app is already in the background', async () => {
    appState.currentState = 'background';
    await expect(confirmExternalShare()).resolves.toBe(true);
    expect(appState.addEventListener).not.toHaveBeenCalled();
  });

  it('counts once the app leaves the foreground', async () => {
    let listener: ((state: string) => void) | undefined;
    appState.addEventListener.mockImplementation((_event: string, cb: (state: string) => void) => {
      listener = cb;
      return { remove: jest.fn() };
    });

    const pending = confirmExternalShare(1_000);
    expect(listener).toBeDefined();
    listener?.('background');
    await expect(pending).resolves.toBe(true);
  });

  it('does not count when the user never leaves the app', async () => {
    appState.addEventListener.mockImplementation(() => ({ remove: jest.fn() }));
    await expect(confirmExternalShare(20)).resolves.toBe(false);
  });
});

describe('isCopyShareActivity', () => {
  it('treats the iOS pasteboard activity as a copy, not a share', () => {
    expect(isCopyShareActivity('com.apple.UIKit.activity.CopyToPasteboard')).toBe(true);
    expect(isCopyShareActivity('net.whatsapp.WhatsApp.ShareExtension')).toBe(false);
    expect(isCopyShareActivity(null)).toBe(false);
  });
});

describe('watchShareHandoff', () => {
  it('counts a real destination app, not the share-sheet overlay', () => {
    let listener: ((state: string) => void) | undefined;
    appState.addEventListener.mockImplementation((_event: string, cb: (state: string) => void) => {
      listener = cb;
      return { remove: jest.fn() };
    });

    const watch = watchShareHandoff();
    expect(watch.didLeave()).toBe(false);
    listener?.('inactive');
    expect(watch.didLeave()).toBe(false);
    listener?.('background');
    expect(watch.didLeave()).toBe(true);
    watch.stop();
  });
});

describe('SHARE_HANDOFF_MS', () => {
  it('is long enough for a real app switch and short enough to catch a cancelled tap', () => {
    expect(SHARE_HANDOFF_MS).toBeGreaterThanOrEqual(1_500);
    expect(SHARE_HANDOFF_MS).toBeLessThanOrEqual(4_000);
  });
});
