import { Linking } from 'react-native';
import { openHighlightPlayback } from '../openHighlightPlayback';

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn(() => Promise.resolve()) },
  Platform: { OS: 'ios', select: (spec: { ios?: unknown; default?: unknown }) => spec.ios ?? spec.default },
}));

describe('openHighlightPlayback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens YouTube externally and does not open the sheet', () => {
    const openSheet = jest.fn();
    const ok = openHighlightPlayback(
      ['https://www.youtube.com/watch?v=k9CYpl2fRx4'],
      openSheet,
    );
    expect(ok).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('youtube.com/watch?v=k9CYpl2fRx4'),
    );
    expect(openSheet).not.toHaveBeenCalled();
  });

  it('opens the sheet for Streamin / direct MP4', () => {
    const openSheet = jest.fn();
    const ok = openHighlightPlayback(['https://streamin.link/v/abc123'], openSheet);
    expect(ok).toBe(true);
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(openSheet).toHaveBeenCalledWith(['https://streamin.link/v/abc123']);
  });

  it('prefers direct over YouTube when both are present', () => {
    const openSheet = jest.fn();
    openHighlightPlayback(
      [
        'https://www.youtube.com/watch?v=k9CYpl2fRx4',
        'https://streamin.link/v/abc123',
      ],
      openSheet,
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
    // Sheet gets Streamin; YouTube may be appended on Android only.
    expect(openSheet).toHaveBeenCalled();
    const passed = openSheet.mock.calls[0][0] as string[];
    expect(passed[0]).toBe('https://streamin.link/v/abc123');
  });

  it('skips unsupported hosts and opens YouTube instead of the sheet', () => {
    const openSheet = jest.fn();
    const ok = openHighlightPlayback(
      [
        'https://streama.in/clip/dead',
        'https://www.youtube.com/watch?v=k9CYpl2fRx4',
      ],
      openSheet,
    );
    expect(ok).toBe(true);
    expect(openSheet).not.toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('youtube.com/watch?v=k9CYpl2fRx4'),
    );
  });

  it('returns false when every URL is unsupported', () => {
    const openSheet = jest.fn();
    expect(openHighlightPlayback(['https://streama.in/clip/dead'], openSheet)).toBe(false);
    expect(openSheet).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
