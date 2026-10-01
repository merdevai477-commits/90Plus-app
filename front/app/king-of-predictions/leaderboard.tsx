import { useLocalSearchParams } from 'expo-router';

import { KingLeaderboardScreen } from '../../components/KingOfPredictions/LeaderboardScreen';

export default function KingLeaderboardRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <KingLeaderboardScreen mode={mode} />;
}
