/**
 * Older Egypt entry — opens the league cards on the Egyptian league.
 */

import { Redirect } from 'expo-router';

export default function TopScorersFiveEgyptRoute() {
  return <Redirect href={{ pathname: '/top-scorers-five', params: { league: 'egypt' } }} />;
}
