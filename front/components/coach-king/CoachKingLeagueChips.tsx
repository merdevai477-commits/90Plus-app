import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useAppFont } from '../../utils/fontSetup';

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
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            testID={`ck-league-${key}`}
            style={[styles.chip, on && styles.chipOn]}
          >
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
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(140,92,245,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(184,150,252,0.35)',
  },
  chipOn: {
    backgroundColor: ACTIVE,
    borderColor: ACTIVE,
  },
  txt: {
    fontSize: 13,
  },
});
