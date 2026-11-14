/**
 * Automatic milestone badges are off.
 * A badge appears only after a mentor grants it from the review desk.
 */

export async function awardLoginStreakMilestone(_userId: string, _days: number): Promise<void> {
    return;
}

export async function awardCompetitionChampion(
    _userId: string,
    _competitionId: string,
    _prizeName: string,
): Promise<void> {
    return;
}

export async function evaluateEliteMilestones(): Promise<void> {
    return;
}
