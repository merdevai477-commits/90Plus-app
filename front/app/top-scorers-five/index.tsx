/**
 * Top Scorers Five route — /top-scorers-five
 *
 * Thin entry point; the screen lives in components/TopScorersFive, matching
 * how share-win and king-of-predictions delegate to their hub screens.
 */

import TopScorersFiveScreen from '../../components/TopScorersFive/TopScorersFiveScreen';

export default function TopScorersFiveRoute() {
  return <TopScorersFiveScreen />;
}
