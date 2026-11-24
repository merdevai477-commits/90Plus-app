import { useLocalSearchParams } from 'expo-router';

import { KingPlayScreen } from '../../components/KingOfPredictions/PlayScreen';

export default function KingPlayRoute() {
  const { mode, date, tab } = useLocalSearchParams<{ mode?: string; date?: string; tab?: string }>();
  return <KingPlayScreen mode={mode} date={date} tab={tab} />;
}
