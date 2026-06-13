import { mapFixtureToMatch } from '../../components/Matches/leagueApiUtils';
import type { Match } from '../../components/Matches/matchCardUtils';
import type { LiveFixtureSnapshot } from '../store/liveFixtureStore.types';

/** Map canonical live snapshot → list card row (minute/score/status from reconciled fixture). */
export function snapshotToMatchRow(snapshot: LiveFixtureSnapshot): Match {
  return mapFixtureToMatch(snapshot.fixture);
}
