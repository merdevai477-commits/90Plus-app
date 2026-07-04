export interface GroupInsightData {
  rank: number | null;
  pointsToNextRank: number | null;
  nextRank: number | null;
}

export function buildGroupMotivationText(
  insight: GroupInsightData,
  labels: {
    leading: string;
    rankGap: string;
    notRanked: string;
  },
): string {
  if (!insight.rank) return labels.notRanked;
  if (insight.rank === 1 || insight.pointsToNextRank == null || insight.nextRank == null) {
    return labels.leading;
  }
  return labels.rankGap
    .replace('{rank}', String(insight.rank))
    .replace('{points}', String(insight.pointsToNextRank))
    .replace('{nextRank}', String(insight.nextRank));
}
