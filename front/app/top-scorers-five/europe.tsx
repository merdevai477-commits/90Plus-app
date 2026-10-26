/**
 * Europe Top Five was replaced by King of Coaches. Old links open the Egyptian five.
 */

import { Redirect } from 'expo-router';

export default function TopScorersFiveEuropeRoute() {
  return <Redirect href={{ pathname: '/top-scorers-five/pick', params: { mode: 'egypt' } }} />;
}
