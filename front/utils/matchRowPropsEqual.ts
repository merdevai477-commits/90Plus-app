/**
 * MatchRow equality. A new predictedMatches object must not rerender rows
 * whose own prediction, score, and clock did not change.
 */
export type MatchRowPrediction = {
  type: string;
  isCorrect?: boolean | null;
  coinsWon?: number;
};

export type MatchRowFixtureFields = {
  id: string;
  status: string;
  statusShort?: string;
  elapsed?: number | null;
  extra?: number | null;
  homeScore: number;
  awayScore: number;
  live?: boolean;
  minute?: string;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  time?: string;
  corners?: { home: number; away: number };
};

export type MatchRowCompareProps = {
  fixture: MatchRowFixtureFields;
  showPreds: boolean;
  onPredict: unknown;
  submittingId: string | null;
  predictedMatches: Record<string, MatchRowPrediction | undefined>;
  isSubscribed: boolean;
  isSubscribing: boolean;
  onToggleSubscription: unknown;
  onOpenDetails: unknown;
  worldCupCard?: { logoSource: unknown; leagueName: string };
  onFixtureVisibility?: unknown;
  /** Bumps when Arabic name translations arrive, so a memoized row can refresh both teams together. */
  nameRevision?: number;
};

function predictionStamp(
  map: Record<string, MatchRowPrediction | undefined>,
  fixtureId: string,
): string {
  const entry = map[fixtureId];
  if (!entry) return '';
  return `${entry.type}|${entry.isCorrect ?? ''}|${entry.coinsWon ?? ''}`;
}

/** True when React may skip rendering this row. */
export function matchRowPropsEqual(prev: MatchRowCompareProps, next: MatchRowCompareProps): boolean {
  const a = prev.fixture;
  const b = next.fixture;
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.statusShort === b.statusShort &&
    a.elapsed === b.elapsed &&
    a.extra === b.extra &&
    a.homeScore === b.homeScore &&
    a.awayScore === b.awayScore &&
    a.live === b.live &&
    a.minute === b.minute &&
    a.home === b.home &&
    a.away === b.away &&
    a.homeLogo === b.homeLogo &&
    a.awayLogo === b.awayLogo &&
    a.time === b.time &&
    a.corners?.home === b.corners?.home &&
    a.corners?.away === b.corners?.away &&
    prev.showPreds === next.showPreds &&
    prev.onPredict === next.onPredict &&
    prev.submittingId === next.submittingId &&
    predictionStamp(prev.predictedMatches, a.id) === predictionStamp(next.predictedMatches, a.id) &&
    prev.isSubscribed === next.isSubscribed &&
    prev.isSubscribing === next.isSubscribing &&
    prev.onToggleSubscription === next.onToggleSubscription &&
    prev.onOpenDetails === next.onOpenDetails &&
    prev.worldCupCard?.leagueName === next.worldCupCard?.leagueName &&
    prev.worldCupCard?.logoSource === next.worldCupCard?.logoSource &&
    prev.onFixtureVisibility === next.onFixtureVisibility &&
    prev.nameRevision === next.nameRevision
  );
}
