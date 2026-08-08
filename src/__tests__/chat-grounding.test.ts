/**
 * Unit tests for the strict grounding helpers that stop the Captain agent from
 * embellishing/contradicting tool data (invented WC years, wrong club, etc.).
 */
import {
  buildGroundedFactReply,
  buildGroundingSystemMessage,
  extractGroundedFacts,
} from '../services/chat-grounding.service';

const hakimiPayload = JSON.stringify({
  source: '365scores_profile',
  name: 'أشرف حكيمي',
  club: 'باريس سان جيرمان',
  clubRaw: 'باريس سان جيرمان',
  quickFacts: {
    currentClub: 'باريس سان جيرمان',
    worldCupTitles: 0,
    championsLeagueTitles: 4,
    latestSeasonLine: '2025/2026: 4G / 11A / 42 apps',
  },
});

const yamalPayload = JSON.stringify({
  source: '365scores_profile',
  name: 'لامين يامال',
  club: 'برشلونة',
  quickFacts: {
    currentClub: 'برشلونة',
    worldCupTitles: 1,
    championsLeagueTitles: 0,
    latestSeasonLine: '2025/2026: 25G / 17A / 53 apps',
  },
});

const messiPayload = JSON.stringify({
  source: '365scores_profile',
  name: 'ليونيل ميسي',
  club: 'انتر ميامي',
  quickFacts: {
    currentClub: 'انتر ميامي',
    worldCupTitles: 1,
    championsLeagueTitles: 4,
  },
});

const dembelePayload = JSON.stringify({
  source: '365scores_profile',
  name: 'عثمان ديمبيلي',
  club: 'باريس سان جيرمان',
  quickFacts: { currentClub: 'باريس سان جيرمان', worldCupTitles: 1, championsLeagueTitles: 2 },
});

const ahlyPayload = JSON.stringify({
  teamId: 1015,
  teamName: 'الأهلي',
  cafChampionsLeagueWins: 12,
  quickFacts: { cafChampionsLeagueWins: 12 },
});

describe('chat-grounding: extractGroundedFacts', () => {
  test('parses a 365 player profile payload', () => {
    const { players } = extractGroundedFacts([hakimiPayload]);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      name: 'أشرف حكيمي',
      currentClub: 'باريس سان جيرمان',
      worldCupTitles: 0,
      championsLeagueTitles: 4,
    });
  });

  test('parses a team payload', () => {
    const { teams } = extractGroundedFacts([ahlyPayload]);
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ teamName: 'الأهلي', cafChampionsLeagueWins: 12 });
  });

  test('recovers facts from a truncated (jsonCap) payload', () => {
    const truncated = JSON.stringify({
      truncated: true,
      preview:
        '{"source":"365scores_profile","name":"أشرف حكيمي","club":"باريس سان جيرمان","quickFacts":{"currentClub":"باريس سان جيرمان","worldCupTitles":0,"championsLeagueTitles":4,"latestSeasonLine":"2025/2026',
      note: 'Result truncated for size',
    });
    const { players } = extractGroundedFacts([truncated]);
    expect(players[0]).toMatchObject({
      currentClub: 'باريس سان جيرمان',
      worldCupTitles: 0,
      championsLeagueTitles: 4,
    });
  });

  test('ignores error payloads', () => {
    const { players, teams } = extractGroundedFacts([
      JSON.stringify({ error: 'player_not_found' }),
    ]);
    expect(players).toHaveLength(0);
    expect(teams).toHaveLength(0);
  });
});

describe('chat-grounding: buildGroundedFactReply', () => {
  test('Hakimi UCL count names the current club (PSG) and never invents a year', () => {
    const facts = extractGroundedFacts([hakimiPayload]);
    const reply = buildGroundedFactReply('حكيمي معاه كام شامبيونز ليج؟', facts, 'ar');
    expect(reply).toContain('4');
    expect(reply).toContain('باريس سان جيرمان');
    expect(reply).not.toMatch(/ريال مدريد|\b20\d{2}\b/);
  });

  test('Yamal World Cup reflects the tool count of 1 (never "hasn\'t won")', () => {
    const facts = extractGroundedFacts([yamalPayload]);
    const reply = buildGroundedFactReply('يامال معاه كاس عالم ولا لا؟', facts, 'ar');
    expect(reply).toContain('كاس عالم');
    expect(reply).not.toMatch(/معندوش|ماكسبش|لسه صغير/);
  });

  test('Messi World Cup says 1 without adding a year', () => {
    const facts = extractGroundedFacts([messiPayload]);
    const reply = buildGroundedFactReply('ميسي معاه كام كاس عالم؟', facts, 'ar');
    expect(reply).toContain('كاس عالم واحد');
    expect(reply).not.toMatch(/\b20\d{2}\b/);
  });

  test('Ahly CAF titles use the tool number 12', () => {
    const facts = extractGroundedFacts([ahlyPayload]);
    const reply = buildGroundedFactReply('الاهلي معاه كام افريقيا؟', facts, 'ar');
    expect(reply).toContain('12');
    expect(reply).toContain('أفريقيا');
  });

  test('Dembele current club is PSG', () => {
    const facts = extractGroundedFacts([dembelePayload]);
    const reply = buildGroundedFactReply('اين يلعب ديبوريم حاليا؟', facts, 'ar');
    expect(reply).toContain('باريس سان جيرمان');
  });

  test('zero World Cup titles say "not won yet" without inventing a number', () => {
    const facts = extractGroundedFacts([hakimiPayload]); // Hakimi WC = 0
    const reply = buildGroundedFactReply('حكيمي معاه كام كاس عالم؟', facts, 'ar');
    expect(reply).toMatch(/معندوش/);
  });

  test('season / non-high-risk questions defer to the LLM (return null)', () => {
    const facts = extractGroundedFacts([messiPayload]);
    expect(buildGroundedFactReply('بيانات اخر سيزون لميسي', facts, 'ar')).toBeNull();
  });

  test('rich "tell me about his career" requests defer to the LLM', () => {
    const facts = extractGroundedFacts([hakimiPayload]);
    expect(
      buildGroundedFactReply('احكيلي عن مسيرة حكيمي وكام شامبيونز', facts, 'ar'),
    ).toBeNull();
  });
});

describe('chat-grounding: buildGroundingSystemMessage', () => {
  test('enumerates the authoritative facts and forbids invented years', () => {
    const facts = extractGroundedFacts([hakimiPayload, ahlyPayload]);
    const msg = buildGroundingSystemMessage(facts)!;
    expect(msg).toContain('باريس سان جيرمان');
    expect(msg).toContain('دوري أبطال أوروبا: 4');
    expect(msg).toContain('دوري أبطال أفريقيا: 12');
    expect(msg).toMatch(/ممنوع/);
  });

  test('returns null when there are no facts', () => {
    expect(buildGroundingSystemMessage({ players: [], teams: [] })).toBeNull();
  });
});
