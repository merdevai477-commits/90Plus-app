import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  title: string;
  points: number;
  unit: string;
  leagueCount: string;
  detailsLabel: string;
  onDetails?: () => void;
  rtl: boolean;
  titleFont?: string;
  valueFont?: string;
  bodyFont?: string;
};

/** Overall-points card — Figma 2336:8052. */
export function TsfPointsHero({
  title,
  points,
  unit,
  leagueCount,
  detailsLabel,
  onDetails,
  rtl,
  titleFont,
  valueFont,
  bodyFont,
}: Props) {
  const row = rtl ? styles.rowRtl : styles.row;

  return (
    <LinearGradient
      colors={['#A636F2', '#40128C']}
      start={{ x: rtl ? 1 : 0, y: 0.5 }}
      end={{ x: rtl ? 0 : 1, y: 0.5 }}
      style={styles.card}
    >
      <View style={row}>
        <Text style={[styles.title, { fontFamily: titleFont }]}>{title}</Text>
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { fontFamily: bodyFont }]}>{leagueCount}</Text>
        </View>
      </View>
      <View style={[row, styles.valueRow]}>
        <View style={styles.valueWrap}>
          <Text style={[styles.unit, { fontFamily: bodyFont }]}>{unit}</Text>
          <Text style={[styles.value, { fontFamily: valueFont }]}>{points.toLocaleString('en-US')}</Text>
        </View>
        {onDetails ? (
          <TouchableOpacity
            onPress={onDetails}
            accessibilityRole="button"
            style={[styles.details, rtl && styles.rowRtl]}
          >
            <Text style={[styles.detailsText, { fontFamily: bodyFont }]}>{detailsLabel}</Text>
            <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        ) : null}
      </View>
    </LinearGradient>
  );
}

export function TsfIslandBack({
  onPress,
  label,
  rtl,
  light,
}: {
  onPress: () => void;
  label: string;
  rtl: boolean;
  light?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.island, rtl ? styles.islandEnd : styles.islandStart, light && styles.islandOnDark]}
    >
      <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={22} color={light ? '#FFFFFF' : '#24104E'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 11,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowRtl: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#FFFFFF', fontSize: 18 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12 },
  valueRow: { alignItems: 'flex-end' },
  valueWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  unit: { color: 'rgba(255,255,255,0.9)', fontSize: 19, marginBottom: 6 },
  value: { color: '#FFFFFF', fontSize: 48, lineHeight: 52 },
  details: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  detailsText: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  island: {
    position: 'absolute',
    top: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(75,31,163,0.16)',
    shadowColor: '#2A1060',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  islandOnDark: {
    backgroundColor: 'rgba(8,6,16,0.55)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  islandStart: { left: 12 },
  islandEnd: { right: 12 },
});
