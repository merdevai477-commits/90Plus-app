import { prizeCtaKind, hasSponsorSocialLinks } from '../prizeCta';
import { isEntryOpen, type CompetitionInfo } from '../../../services/competitions.service';

const HOUR = 3_600_000;

function competition(overrides: Partial<CompetitionInfo> = {}): CompetitionInfo {
  return {
    id: 'c1',
    sponsor: {
      id: 's1',
      name: 'Kick Zone',
      description: null,
      logoUrl: null,
      address: null,
      hasDelivery: false,
      socialLinks: null,
      isVerified: true,
      isActive: true,
    },
    category: {
      id: 'cat1',
      key: 'sportswear',
      nameAr: 'ملابس',
      description: null,
      icon: null,
      sortOrder: 1,
      isActive: true,
    },
    prizeName: 'Shoes',
    prizeImageUrl: null,
    prizeType: 'sportswear',
    prizeDescription: null,
    winnersCount: 1,
    apiMatchId: 1,
    homeTeam: 'A',
    awayTeam: 'B',
    homeTeamLogo: null,
    awayTeamLogo: null,
    matchDate: new Date(Date.now() + 2 * HOUR).toISOString(),
    leagueName: null,
    matchStatus: null,
    resultHomeScore: null,
    resultAwayScore: null,
    predictionDeadline: new Date(Date.now() + HOUR).toISOString(),
    predictionMode: 'EXACT_SCORE',
    status: 'PUBLISHED',
    rules: null,
    startAt: null,
    endAt: null,
    isFree: true,
    participantsCount: 0,
    myEntry: null,
    ...overrides,
  };
}

const entry = {
  id: 'e1',
  predictedHomeScore: 2,
  predictedAwayScore: 0,
  predictedWinner: null,
  isCorrect: null as boolean | null,
  isWinner: false,
  rank: null as number | null,
  createdAt: new Date().toISOString(),
};

describe('prizeCtaKind', () => {
  it('invites a prediction on a live unpublished-entry row', () => {
    expect(prizeCtaKind(competition())).toBe('predict');
    expect(isEntryOpen(competition())).toBe(true);
  });

  it('keeps the invite on a DRAFT wizard preview', () => {
    expect(prizeCtaKind(competition({ status: 'DRAFT' }))).toBe('predict');
  });

  it('waits for the winner after the user has entered', () => {
    expect(prizeCtaKind(competition({ myEntry: entry }))).toBe('waiting');
  });

  it('turns grey once predictions have closed without a scored entry', () => {
    expect(
      prizeCtaKind(
        competition({ predictionDeadline: new Date(Date.now() - 1000).toISOString() }),
      ),
    ).toBe('ended');
  });

  it('is green when the prediction is correct', () => {
    expect(
      prizeCtaKind(
        competition({
          status: 'SETTLED',
          myEntry: { ...entry, isCorrect: true },
        }),
      ),
    ).toBe('correct');
  });

  it('is red when the prediction is wrong', () => {
    expect(
      prizeCtaKind(
        competition({
          status: 'SETTLED',
          myEntry: { ...entry, isCorrect: false },
        }),
      ),
    ).toBe('wrong');
  });
});

describe('hasSponsorSocialLinks', () => {
  it('hides the block when every link is missing', () => {
    expect(hasSponsorSocialLinks(null)).toBe(false);
    expect(hasSponsorSocialLinks({ facebook: '  ', instagram: '', whatsapp: undefined })).toBe(
      false,
    );
  });

  it('shows the block when any link is present', () => {
    expect(hasSponsorSocialLinks({ facebook: 'https://facebook.com/x' })).toBe(true);
  });
});
