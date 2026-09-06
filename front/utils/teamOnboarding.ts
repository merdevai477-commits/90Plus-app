export const MAX_ONBOARDING_TEAMS = 3;

export interface OnboardingClubPick {
  competitorId: number;
  name: string;
  nameAr?: string;
  logo: string | null;
  country: string | null;
  isLocal?: boolean;
}

export function needsTeamOnboarding(
  user: { teamOnboardingCompleted?: boolean | null } | null | undefined,
): boolean {
  return user?.teamOnboardingCompleted === false;
}

export function canSubmitOnboardingPicks(count: number): boolean {
  return count >= 1 && count <= MAX_ONBOARDING_TEAMS;
}

export function toggleOnboardingPick(
  selected: OnboardingClubPick[],
  club: OnboardingClubPick,
  max = MAX_ONBOARDING_TEAMS,
): { next: OnboardingClubPick[]; rejected: boolean } {
  const exists = selected.some((row) => row.competitorId === club.competitorId);
  if (exists) {
    return {
      next: selected.filter((row) => row.competitorId !== club.competitorId),
      rejected: false,
    };
  }
  if (selected.length >= max) {
    return { next: selected, rejected: true };
  }
  return { next: [...selected, club], rejected: false };
}
