import { useLocalSearchParams } from 'expo-router';

import { KingWeekScreen } from '../../components/KingOfPredictions/WeekScreen';

export default function KingWeekRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <KingWeekScreen mode={mode} />;
}
