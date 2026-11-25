import { Linking } from 'react-native';
import { openHighlightPlayback } from '../openHighlightPlayback';

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn(() => Promise.resolve()) },
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
    expect(openSheet).toHaveBeenCalledWith([
      'https://streamin.link/v/abc123',
      'https://www.youtube.com/watch?v=k9CYpl2fRx4',
    ]);
  });
});
