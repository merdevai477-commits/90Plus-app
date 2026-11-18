/**
 * Older Europe entry — opens the league cards on the Premier League.
 */

import { Redirect } from 'expo-router';

export default function TopScorersFiveEuropeRoute() {
  return <Redirect href={{ pathname: '/top-scorers-five', params: { league: 'pl' } }} />;
}
