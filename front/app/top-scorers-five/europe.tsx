/**
 * Europe Top Five — opens the pick flow for the five European leagues.
 */

import { Redirect } from 'expo-router';

export default function TopScorersFiveEuropeRoute() {
  return <Redirect href={{ pathname: '/top-scorers-five/pick', params: { mode: 'europe' } }} />;
}
