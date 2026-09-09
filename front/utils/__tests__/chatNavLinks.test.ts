import {
  decodeChatNavMarker,
  inferChatNavLinksFromQuestion,
  resolveChatNavAvatar,
  resolveChatNavClubBadge,
  resolveChatNavClubBadgeCandidates,
  resolveChatNavPlayerPhotos,
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

  it('keeps club choices and logos on the hidden nav marker', () => {
    const [link] = sanitizeChatNavLinks([
      {
        type: 'club',
        id: 8200,
        label: 'الأهلي المصري',
        choice: true,
        subtitle: 'مصر',
        logo: 'https://img/ahly.png',
      },
    ]);
    expect(link).toEqual(
      expect.objectContaining({
        type: 'club',
        id: 8200,
        choice: true,
        subtitle: 'مصر',
        logo: 'https://img/ahly.png',
      }),
    );
  });

  it('infers Egyptian vs Saudi Al Ahly choices from a bare الأهلي question', () => {
    const links = inferChatNavLinksFromQuestion('معلومات عن النادي الاهلي', 'ar');
    expect(links.map((l) => l.id)).toEqual([8200, 8946]);
    expect(links.every((l) => l.choice && l.type === 'club')).toBe(true);
  });

  it('resolves a player club badge from logo or teamId', () => {
    expect(
      resolveChatNavClubBadge({
        type: 'player',
        id: 42,
        label: 'Salah',
        logo: 'https://img/liv.png',
      }),
    ).toBe('https://img/liv.png');
    expect(
      resolveChatNavClubBadge({
        type: 'player',
        id: 42,
        label: 'Salah',
        teamId: 1015,
      }),
    ).toEqual(expect.stringContaining('/Competitors/1015'));
    expect(resolveChatNavClubBadge({ type: 'player', id: 42, label: 'Salah' })).toBeNull();
  });

  it('prefers Athletes CDN for player photos and still lists NationalTeam last', () => {
    const uris = resolveChatNavPlayerPhotos({
      type: 'player',
      id: 110445,
      label: 'Salah',
      photo:
        'https://imageprod.365scores.com/image/upload/w_80,h_80,c_limit,q_auto:eco,f_webp,d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/Athletes/NationalTeam/110445',
    });
    expect(uris[0]).toContain('/Athletes/110445');
    expect(uris[0]).not.toContain('NationalTeam');
    expect(uris.some((u) => u.includes('/Athletes/NationalTeam/110445'))).toBe(true);
  });

  it('builds club badge candidates from logo then teamId', () => {
    const uris = resolveChatNavClubBadgeCandidates({
      type: 'player',
      id: 42,
      label: 'Salah',
      logo: 'https://img/liv.png',
      teamId: 1015,
    });
    expect(uris[0]).toBe('https://img/liv.png');
    expect(uris[1]).toEqual(expect.stringContaining('/Competitors/1015'));
  });

  it('maps photoUrl and currentClub.logoUrl onto photo/logo/teamId', () => {
    const links = sanitizeChatNavLinks([
      {
        type: 'player',
        id: 1,
        label: 'Salah',
        photoUrl: 'https://cdn/p.png',
        currentClub: { logoUrl: 'https://cdn/c.png', id: 9 },
      },
    ]);
    expect(links[0]).toEqual(
      expect.objectContaining({
        photo: 'https://cdn/p.png',
        logo: 'https://cdn/c.png',
        teamId: 9,
      }),
    );
  });
});
