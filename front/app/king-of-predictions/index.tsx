import { useLocalSearchParams } from 'expo-router';

import { KingPlayScreen } from '../../components/KingOfPredictions/PlayScreen';
import { cairoTodayKey } from '../../components/KingOfPredictions/shared';

/**
 * Contest entry opens the Figma play surface (2032:202) directly —
 * mode tabs switch Predictions ↔ Results on the same screen.
 */
export default function KingOfPredictionsIndex() {
  const { mode, date } = useLocalSearchParams<{ mode?: string; date?: string }>();
  return <KingPlayScreen mode={mode} date={date || cairoTodayKey()} />;
}
