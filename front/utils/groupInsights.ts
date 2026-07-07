/**
 * Builds the daily motivational message shown on the group ranking card,
 * based on the viewer's daily rank and points gap.
 */

import type { GroupDailyInsight } from '../services/predictionGroups.service';

export interface GroupMotivationLabels {
  /** Viewer leads today's ranking (with points). */
  leading: string;
  /** Viewer is ranked but behind — supports {rank}, {points}, {nextRank}. */
  rankGap: string;
  /** Viewer has no daily points yet. */
  notRanked: string;
}

export const DEFAULT_GROUP_MOTIVATION_LABELS: GroupMotivationLabels = {
  leading: 'أنت متصدّر اليوم! نقاطك {points}. حافظ على الصدارة.',
  rankGap: 'أنت بالمركز {rank} اليوم، وتفصلك {points} نقطة عن المركز {nextRank}.',
  notRanked: 'ابدأ التوقعات اليوم لتظهر في ترتيب اليوم.',
};

export function buildGroupMotivationText(
  insight: GroupDailyInsight | null | undefined,
  labels: GroupMotivationLabels = DEFAULT_GROUP_MOTIVATION_LABELS,
): string {
  if (!insight || insight.rank == null) return labels.notRanked;

  if (insight.isLeading || insight.pointsToNextRank == null || insight.nextRank == null) {
    return labels.leading.replace('{points}', String(insight.points));
  }

  return labels.rankGap
    .replace('{rank}', String(insight.rank))
    .replace('{points}', String(insight.pointsToNextRank))
    .replace('{nextRank}', String(insight.nextRank));
}
