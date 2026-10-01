import { useLocalSearchParams } from 'expo-router';

import { KingPlayScreen } from '../../components/KingOfPredictions/PlayScreen';

export default function KingPlayRoute() {
  const { mode, date } = useLocalSearchParams<{ mode?: string; date?: string }>();
  return <KingPlayScreen mode={mode} date={date} />;
}
