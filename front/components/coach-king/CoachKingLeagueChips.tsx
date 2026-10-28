import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAppFont } from '../../utils/fontSetup';
import {
  TSF_LEAGUE_LOGO,
  TSF_LOGO_TINT_ON_DARK,
  type TsfEuropeLeagueKey,
} from '../TopScorersFive/assets';

const ACTIVE = '#8C5CF5';

type Props = {
  options: readonly string[];
  active: string | null;
  label: (key: string) => string;
  isAr: boolean;
  onChange: (key: string) => void;
};

export function CoachKingLeagueChips({ options, active, label, isAr, onChange }: Props) {
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  if (options.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { flexDirection: isAr ? 'row-reverse' : 'row' }]}
    >
      {options.map((key) => {
        const on = key === active;
        const league = key === 'all' ? null : (key as TsfEuropeLeagueKey);
        const logo = league ? TSF_LEAGUE_LOGO[league] : null;
        const tint = league ? TSF_LOGO_TINT_ON_DARK[league] : undefined;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            testID={`ck-league-${key}`}
            style={[styles.chip, on && styles.chipOn, { flexDirection: isAr ? 'row-reverse' : 'row' }]}
          >
            {logo ? (
              <Image
                source={logo}
                style={styles.logo}
                contentFit="contain"
                tintColor={tint}
              />
            ) : (
              <View style={styles.allIcon}>
                <Ionicons name="globe-outline" size={14} color={on ? '#FFFFFF' : '#C2ABFC'} />
              </View>
            )}
            <Text style={[styles.txt, { fontFamily: on ? fontSemi : fontMed, color: on ? '#FFFFFF' : '#C2ABFC' }]}>
              {label(key)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    columnGap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    alignItems: 'center',
  },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 7,
    backgroundColor: 'rgba(140,92,245,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(184,150,252,0.35)',
  },
  chipOn: {
    backgroundColor: ACTIVE,
    borderColor: ACTIVE,
  },
  logo: {
    width: 18,
    height: 18,
  },
  allIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: {
    fontSize: 13,
  },
});
