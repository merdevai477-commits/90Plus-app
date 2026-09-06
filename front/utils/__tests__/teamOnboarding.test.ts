import {
  canSubmitOnboardingPicks,
  MAX_ONBOARDING_TEAMS,
  needsTeamOnboarding,
  toggleOnboardingPick,
  type OnboardingClubPick,
} from '../teamOnboarding';

const ahly: OnboardingClubPick = {
  competitorId: 8200,
  name: 'Al Ahly',
  logo: null,
  country: 'Egypt',
  isLocal: true,
};
const arsenal: OnboardingClubPick = {
  competitorId: 104,
  name: 'Arsenal',
  logo: null,
  country: 'England',
};
const madrid: OnboardingClubPick = {
  competitorId: 131,
  name: 'Real Madrid',
  logo: null,
  country: 'Spain',
};
const barca: OnboardingClubPick = {
  competitorId: 132,
  name: 'FC Barcelona',
  logo: null,
  country: 'Spain',
};

describe('needsTeamOnboarding', () => {
  it('is true only when the server explicitly says incomplete', () => {
    expect(needsTeamOnboarding({ teamOnboardingCompleted: false })).toBe(true);
    expect(needsTeamOnboarding({ teamOnboardingCompleted: true })).toBe(false);
    expect(needsTeamOnboarding({})).toBe(false);
    expect(needsTeamOnboarding(null)).toBe(false);
  });
});

describe('canSubmitOnboardingPicks', () => {
  it('enables Next from 1 through 3', () => {
    expect(canSubmitOnboardingPicks(0)).toBe(false);
    expect(canSubmitOnboardingPicks(1)).toBe(true);
    expect(canSubmitOnboardingPicks(2)).toBe(true);
    expect(canSubmitOnboardingPicks(3)).toBe(true);
    expect(canSubmitOnboardingPicks(4)).toBe(false);
  });
});

describe('toggleOnboardingPick', () => {
  it('adds, removes, and rejects a fourth pick', () => {
    const one = toggleOnboardingPick([], ahly);
    const two = toggleOnboardingPick(one.next, arsenal);
    const three = toggleOnboardingPick(two.next, madrid);
    expect(three.next).toHaveLength(MAX_ONBOARDING_TEAMS);

    const rejected = toggleOnboardingPick(three.next, barca);
    expect(rejected.rejected).toBe(true);
    expect(rejected.next).toHaveLength(3);

    const removed = toggleOnboardingPick(three.next, arsenal);
    expect(removed.next.map((row) => row.competitorId)).toEqual([8200, 131]);
  });
});
