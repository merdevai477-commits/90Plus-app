import {
  buildAgentVoicePrompt,
  formatEntityBrief,
  formatPlayerLastMatchReply,
  planAgentPrefetch,
} from '../services/chat-agent.service';

describe('buildAgentVoicePrompt', () => {
  it('stays short enough to keep the first token fast', () => {
    const prompt = buildAgentVoicePrompt('medium');
    expect(prompt).toContain('90Plus agent');
    expect(prompt).toContain('لهجة مصرية');
    expect(prompt.length).toBeLessThan(900);
  });
});

describe('formatEntityBrief', () => {
  it('builds a player brief from the same career fields as the profile', () => {
    const text = formatEntityBrief(
      {
        source: '365scores_profile',
        name: 'محمد صلاح',
        club: 'ليفربول',
        quickFacts: {
          currentClub: 'ليفربول',
          position: 'مهاجم',
          age: 33,
          nationality: 'مصر',
          jerseyNumber: 11,
        },
        seasonStats: { label: '2025/26', goals: 12, assists: 4, appearances: 28 },
        recentSeasons: [
          { label: '2025/26', clubs: ['ليفربول'], goals: 12, assists: 4, appearances: 28 },
          { label: '2024/25', clubs: ['ليفربول'], goals: 29, assists: 18, appearances: 38 },
        ],
        nextGame: { home: 'ليفربول', away: 'آرسنال', kickoff: '2026-09-12T19:00:00Z' },
      },
      'ar',
    );
    expect(text).toContain('**محمد صلاح**');
    expect(text).toContain('ليفربول');
    expect(text).toContain('12');
    expect(text).toContain('| الموسم | النادي | أهداف | صناعة | لعب |');
    expect(text).toContain('المباراة الجاية');
    expect(text).toContain('رقم القميص: 11');
  });

  it('builds a club brief from coach, stadium, and latest matches', () => {
    const text = formatEntityBrief(
      {
        source: '365scores_team',
        teamName: 'الأهلي المصري',
        coach: 'حسين عموتة',
        country: 'مصر',
        stadium: 'ستاد القاهرة',
        competitions: [{ id: 1, name: 'الدوري المصري' }],
        recentMatches: {
          upcoming: [{ home: 'الأهلي', away: 'الزمالك', kickoff: '2026-09-20T18:00:00Z' }],
          finished: [{ home: 'الأهلي', away: 'بيراميدز', score: { home: 2, away: 1 } }],
        },
      },
      'ar',
    );
    expect(text).toContain('**الأهلي المصري**');
    expect(text).toContain('حسين عموتة');
    expect(text).toContain('ستاد القاهرة');
    expect(text).toContain('المباراة الجاية');
    expect(text).toContain('آخر مباراة');
    expect(text).toContain('2-1');
  });
});

describe('player last-match follow-up', () => {
  const history = [
    { role: 'user', content: 'مبابي' },
    {
      role: 'assistant',
      content: '**كيليان مبابي** بيلعب دلوقتي في **ريال مدريد**.',
    },
  ];

  it('searches the player from the thread, not the follow-up sentence', () => {
    expect(planAgentPrefetch('اخر مباراه لعبها؟', history)).toEqual({
      tool: 'search_football',
      query: 'كيليان مبابي',
    });
  });

  it('answers the last match from the profile payload', () => {
    const text = formatPlayerLastMatchReply(
      {
        name: 'كيليان مبابي',
        lastMatch: {
          opponent: 'برشلونة',
          competition: 'الليجا',
          kickoff: '2026-03-01T20:00:00Z',
          rating: 8.2,
        },
      },
      'ar',
    );
    expect(text).toContain('**كيليان مبابي**');
    expect(text).toContain('**برشلونة**');
    expect(text).toContain('الليجا');
    expect(text).toContain('2026-03-01');
    expect(text).toContain('8.2');
  });
});
