import {
  OnboardingService,
  parseOnboardingTeamsBody,
  pickFifaClubFromOnboarding,
} from '../onboarding.service';
import { mapCountryInput } from '../../data/country-catalog';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    favoriteTeam: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

jest.mock('../notify.service', () => ({ notifyUser: jest.fn(() => Promise.resolve()) }));
jest.mock('../xp.service', () => ({ awardXp: jest.fn(() => Promise.resolve({ awarded: 0 })) }));
jest.mock('../profile-completion.service', () => ({
  ProfileCompletionService: { getCompletionStatus: jest.fn(() => Promise.resolve()) },
}));
jest.mock('../football-data-cache.service', () => ({
  footballDataCacheService: { getCached365Standings: jest.fn() },
}));
jest.mock('../geo-country.service', () => ({
  resolveGeoCountry: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../notification.service', () => ({
  NotificationType: { GENERAL: 'GENERAL' },
}));

describe('parseOnboardingTeamsBody', () => {
  it('accepts skip with zero teams', () => {
    expect(parseOnboardingTeamsBody({ skipped: true })).toEqual({ skipped: true, teams: [] });
  });

  it('caps teams at 3 and drops invalid ids', () => {
    const parsed = parseOnboardingTeamsBody({
      teams: [
        { competitorId: 8200, name: 'Al Ahly', logo: 'a.png', country: 'Egypt', isLocal: true },
        { competitorId: 104, name: 'Arsenal' },
        { competitorId: 131, name: 'Real Madrid' },
        { competitorId: 132, name: 'Barcelona' },
        { competitorId: 0, name: 'Bad' },
      ],
    });
    expect(parsed.skipped).toBe(false);
    expect(parsed.error).toBeUndefined();
    expect(parsed.teams.map((t) => t.competitorId)).toEqual([8200, 104, 131]);
  });

  it('rejects next with no teams', () => {
    const parsed = parseOnboardingTeamsBody({ teams: [] });
    expect(parsed.error).toBeTruthy();
  });
});

describe('pickFifaClubFromOnboarding', () => {
  const egypt = mapCountryInput('eg');

  it('picks the first local club and ignores globals', () => {
    const picked = pickFifaClubFromOnboarding(
      [
        { competitorId: 104, name: 'Arsenal', country: 'England' },
        { competitorId: 8200, name: 'Al Ahly', country: 'Egypt', isLocal: true },
      ],
      egypt,
    );
    expect(picked?.competitorId).toBe(8200);
  });

  it('returns null when only global clubs are selected', () => {
    expect(
      pickFifaClubFromOnboarding(
        [{ competitorId: 104, name: 'Arsenal', country: 'England' }],
        egypt,
      ),
    ).toBeNull();
  });

  it('uses isLocal even when the user has no stored country', () => {
    const picked = pickFifaClubFromOnboarding(
      [{ competitorId: 8200, name: 'Al Ahly', country: 'Egypt', isLocal: true }],
      null,
    );
    expect(picked?.competitorId).toBe(8200);
  });
});

describe('OnboardingService.complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not follow again when already completed', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      country: 'eg',
      favoriteTeam: 'Al Ahly',
      clubLogo: 'https://logo',
      teamOnboardingCompletedAt: new Date('2026-09-01T00:00:00.000Z'),
    });

    const result = await OnboardingService.complete({
      clerkUserId: 'user_1',
      skipped: false,
      teams: [{ competitorId: 104, name: 'Arsenal', country: 'England' }],
    });

    expect(result).toEqual({ alreadyCompleted: true, followed: 0, fifaClubSet: false });
    expect(prisma.favoriteTeam.upsert).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
