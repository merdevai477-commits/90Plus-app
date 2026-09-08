import { getPlaceholderUrl, isPersistedPlaceholderUrl } from '../stadium-image.config';

describe('stadium-image.config placeholders', () => {
  const previous = process.env.STADIUM_IMAGE_PLACEHOLDER_URL;

  afterEach(() => {
    if (previous == null) delete process.env.STADIUM_IMAGE_PLACEHOLDER_URL;
    else process.env.STADIUM_IMAGE_PLACEHOLDER_URL = previous;
  });

  it('defaults to the branded SVG, not a real stadium photo', () => {
    delete process.env.STADIUM_IMAGE_PLACEHOLDER_URL;
    expect(getPlaceholderUrl()).toBe('https://90plus.pro/stadium-placeholder.svg');
    expect(getPlaceholderUrl()).not.toMatch(/upload\.wikimedia\.org/i);
  });

  it('treats the branded SVG as a placeholder URL that must not be persisted as found=true', () => {
    expect(isPersistedPlaceholderUrl('https://90plus.pro/stadium-placeholder.svg')).toBe(true);
    expect(isPersistedPlaceholderUrl('https://upload.wikimedia.org/wikipedia/commons/anfield.jpg')).toBe(
      false,
    );
  });

  it('does not treat a Wikimedia stadium photo as a placeholder even if env still points at one', () => {
    const wiki =
      'https://upload.wikimedia.org/wikipedia/commons/0/0e/Estadio_Santiago_Bernab%C3%A9u_Madrid.jpg';
    process.env.STADIUM_IMAGE_PLACEHOLDER_URL = wiki;
    expect(isPersistedPlaceholderUrl(wiki)).toBe(false);
  });
});
