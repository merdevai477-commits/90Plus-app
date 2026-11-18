import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import { useAppFont } from '../../utils/fontSetup';
import {
  TSF_LEAGUE_LOGO,
  TSF_LOGO_TINT_ON_DARK,
  type TsfEuropeLeagueKey,
} from '../TopScorersFive/assets';
import { getCoachKingTheme } from './theme';

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
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getCoachKingTheme(isDark), [isDark]);
  if (options.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={[styles.row, { flexDirection: isAr ? 'row-reverse' : 'row' }]}
    >
      {options.map((key) => {
        const on = key === active;
        const league = key === 'all' ? null : (key as TsfEuropeLeagueKey);
        const logo = league ? TSF_LEAGUE_LOGO[league] : null;
        const tint = league && isDark ? TSF_LOGO_TINT_ON_DARK[league] : undefined;
        const textColor = on ? theme.chipActiveText : theme.chipText;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            testID={`ck-league-${key}`}
            style={[
              styles.chip,
              !isDark && !on ? styles.chipLift : null,
              on ? styles.chipActiveLift : null,
              {
                flexDirection: isAr ? 'row-reverse' : 'row',
                backgroundColor: on ? theme.chipActiveBg : theme.chipBg,
                borderColor: on ? theme.chipActiveBg : theme.chipBorder,
              },
            ]}
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
                <Ionicons name="globe-outline" size={14} color={textColor} />
              </View>
            )}
            <Text style={[styles.txt, { fontFamily: on ? fontSemi : fontMed, color: textColor }]}>
              {label(key)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /** Prevent horizontal ScrollView from eating vertical flex and pushing search down. */
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    columnGap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    alignItems: 'center',
  },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    borderWidth: 1,
  },
  chipLift: {
    shadowColor: '#1A0A3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chipActiveLift: {
    shadowColor: '#6A2BD9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  logo: {
    width: 20,
    height: 20,
  },
  allIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: {
    fontSize: 13,
  },
});
