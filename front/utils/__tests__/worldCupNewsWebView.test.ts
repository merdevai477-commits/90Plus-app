import {
  isAllowedWorldCupNewsUrl,
  isNinetyPlusNewsUrl,
  normalizeExternalNewsUrl,
  parseNewsWebViewMessage,
} from '../worldCupNewsWebView';

describe('worldCupNewsWebView', () => {
  it('allows only 90plus news URLs in the WebView', () => {
    expect(isNinetyPlusNewsUrl('https://90plus.pro/news')).toBe(true);
    expect(isNinetyPlusNewsUrl('https://www.90plus.pro/api/news/world-cup')).toBe(true);
    expect(isNinetyPlusNewsUrl('https://www.aljazeera.net/sport')).toBe(false);
    expect(isAllowedWorldCupNewsUrl('about:blank')).toBe(true);
    expect(isAllowedWorldCupNewsUrl('https://www.aljazeera.net/sport')).toBe(false);
  });

  it('normalizes external news URLs to https', () => {
    expect(normalizeExternalNewsUrl('http://www.aljazeera.net/sport')).toBe(
      'https://www.aljazeera.net/sport',
    );
    expect(normalizeExternalNewsUrl('www.aljazeera.net/sport')).toBe(
      'https://www.aljazeera.net/sport',
    );
    expect(normalizeExternalNewsUrl('about:blank')).toBeNull();
  });

  it('parses external open messages from injected JS', () => {
    expect(
      parseNewsWebViewMessage(
        JSON.stringify({ type: 'OPEN_EXTERNAL', url: 'https://www.aljazeera.net/x' }),
      ),
    ).toEqual({ type: 'OPEN_EXTERNAL', url: 'https://www.aljazeera.net/x' });
  });
});
