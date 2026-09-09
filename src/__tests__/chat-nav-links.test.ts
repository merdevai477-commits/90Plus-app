import {
  decodeChatNavMarker,
  encodeChatNavMarker,
  extractChatNavLinks,
} from '../services/chat-nav-links.service';

describe('chat-nav-links', () => {
  it('extracts player and club links from tool payloads', () => {
    const links = extractChatNavLinks(
      [
        JSON.stringify({
          source: '365scores_profile',
          athleteId: 42,
          name: 'Salah',
          club: 'Liverpool',
          profile: { imageUrl: 'https://img/salah.png' },
        }),
        JSON.stringify({
          source: '365scores_team',
          competitorId: 1015,
          teamName: 'Al Ahly',
        }),
      ],
      ['search_player', 'get_team_info'],
      'en',
    );
    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'player',
          id: 42,
          label: 'Salah',
          photo: 'https://img/salah.png',
        }),
        expect.objectContaining({
          type: 'club',
          id: 1015,
          label: 'Al Ahly',
          logo: expect.stringContaining('/Competitors/1015'),
        }),
      ]),
    );
  });

  it('adds today-matches CTA and a couple of fixture links', () => {
    const links = extractChatNavLinks(
      [
        JSON.stringify({
          live: [{ fixtureId: 11, home: 'Ahly', away: 'Zamalek' }],
          upcoming: [{ fixtureId: 12, home: 'City', away: 'Arsenal' }],
          finished: [],
        }),
      ],
      ['get_today_matches'],
      'ar',
    );
    expect(links.some((l) => l.type === 'matches' && l.label === 'مباريات اليوم')).toBe(true);
    expect(links.filter((l) => l.type === 'match').map((l) => l.id)).toEqual([11, 12]);
  });

  it('round-trips the hidden nav marker without leaking into visible text', () => {
    const encoded = encodeChatNavMarker('**Salah** scored 19.', [
      { type: 'player', id: 42, label: 'Salah' },
    ]);
    const decoded = decodeChatNavMarker(encoded);
    expect(decoded.text).toBe('**Salah** scored 19.');
    expect(decoded.navLinks).toEqual([
      expect.objectContaining({ type: 'player', id: 42, label: 'Salah' }),
    ]);
  });

  it('extracts a match-details chip from a nested compact fixture', () => {
    const links = extractChatNavLinks(
      [
        JSON.stringify({
          match: { fixtureId: 88, home: 'Ahly', away: 'Zamalek' },
        }),
      ],
      ['get_match_details'],
      'ar',
    );
    expect(links).toEqual([
      expect.objectContaining({ type: 'match', id: 88, label: 'Ahly vs Zamalek' }),
    ]);
  });

  it('always emits a player CTA even without an athleteId', () => {
    const links = extractChatNavLinks([], ['search_player'], 'ar', 'صلاح بيلعب فين');
    expect(links.some((l) => l.type === 'player')).toBe(true);
  });

  it('always emits a matches-page CTA from the user question', () => {
    const links = extractChatNavLinks([], [], 'ar', 'مباريات النهاردة');
    expect(links.some((l) => l.type === 'matches')).toBe(true);
  });

  it('does not attach football CTAs to diet questions', () => {
    const links = extractChatNavLinks([], [], 'ar', 'اقترح نظام أكل مناسب');
    expect(links).toEqual([]);
  });

  it('builds a 365Scores headshot when the payload has an athleteId but no imageUrl', () => {
    const links = extractChatNavLinks(
      [JSON.stringify({ source: '365scores_profile', athleteId: 4576, name: 'Mohamed Salah' })],
      ['search_player'],
      'en',
    );
    const player = links.find((l) => l.type === 'player');
    expect(player?.photo).toContain('/Athletes/4576');
  });

  it('turns a bare الأهلي clarification into two club choices with crests', () => {
    const links = extractChatNavLinks(
      [
        JSON.stringify({
          status: 'need_clarification',
          reason: 'same_name_clubs',
          suggestions: [
            {
              competitorId: 8200,
              label: 'الأهلي المصري',
              country: 'مصر',
              logo: 'https://img/ahly.png',
            },
            {
              competitorId: 8946,
              label: 'الأهلي السعودي',
              country: 'السعودية',
              logo: 'https://img/ahli.png',
            },
          ],
        }),
      ],
      ['search_football'],
      'ar',
      'معلومات عن النادي الاهلي',
    );
    expect(links).toEqual([
      expect.objectContaining({
        type: 'club',
        id: 8200,
        label: 'الأهلي المصري',
        choice: true,
        logo: 'https://img/ahly.png',
      }),
      expect.objectContaining({
        type: 'club',
        id: 8946,
        label: 'الأهلي السعودي',
        choice: true,
        logo: 'https://img/ahli.png',
      }),
    ]);
    expect(links.some((l) => l.label === 'بروفايل الفريق' && !l.id)).toBe(false);
  });

  it('offers Egyptian and Saudi Al Ahly when the question is bare الأهلي', () => {
    const links = extractChatNavLinks([], ['search_football'], 'ar', 'معلومات عن النادي الاهلي');
    expect(links.map((l) => l.id)).toEqual([8200, 8946]);
    expect(links.every((l) => l.choice && l.logo)).toBe(true);
  });
});
