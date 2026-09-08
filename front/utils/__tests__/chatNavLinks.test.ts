import {
  decodeChatNavMarker,
  resolveChatNavAvatar,
  sanitizeChatNavLinks,
} from '../chatNavLinks';

describe('chatNavLinks', () => {
  it('keeps a player photo on the hidden nav marker', () => {
    const decoded = decodeChatNavMarker(
      'Career.\n<!--90plus-nav:[{"type":"player","id":4576,"label":"محمد صلاح","photo":"https://img/salah.png"}]-->',
    );
    expect(decoded.text).toBe('Career.');
    expect(decoded.navLinks).toEqual([
      expect.objectContaining({
        type: 'player',
        id: 4576,
        label: 'محمد صلاح',
        photo: 'https://img/salah.png',
      }),
    ]);
  });

  it('uses the 365Scores headshot when the CTA has an athleteId but no photo', () => {
    const avatar = resolveChatNavAvatar({ type: 'player', id: 4576, label: 'Salah' });
    expect(avatar).toEqual({
      kind: 'player',
      uri: expect.stringContaining('/Athletes/4576'),
    });
  });

  it('uses the 365Scores crest when the CTA has a competitorId but no logo', () => {
    const avatar = resolveChatNavAvatar({ type: 'club', id: 1015, label: 'Al Ahly' });
    expect(avatar).toEqual({
      kind: 'club',
      uri: expect.stringContaining('/Competitors/1015'),
    });
  });

  it('falls back to an icon when there is no media or id', () => {
    expect(resolveChatNavAvatar({ type: 'matches', label: "Today's matches" })).toEqual({
      kind: 'icon',
    });
  });

  it('drops non-http photo strings', () => {
    const [link] = sanitizeChatNavLinks([
      { type: 'player', id: 1, label: 'Salah', photo: 'not-a-url' },
    ]);
    expect(link.photo).toBeNull();
  });
});
