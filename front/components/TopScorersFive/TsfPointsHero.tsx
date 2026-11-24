import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
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
  /** Kept for callers; big digits use a system numeric face for clarity. */
  valueFont?: string;
  bodyFont?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Overall-points card — readable across iPhone sizes (Figma 2336:8052). */
export function TsfPointsHero({
  title,
  points,
  unit,
  leagueCount,
  detailsLabel,
  onDetails,
  rtl,
  titleFont,
  bodyFont,
}: Props) {
  const { width } = useWindowDimensions();
  const scale = clamp(width / 390, 0.86, 1.08);
  const titleSize = Math.round(15 * scale);
  const valueSize = Math.round(clamp(width >= 400 ? 44 : width >= 360 ? 40 : 34, 32, 48));
  const unitSize = Math.round(14 * scale);
  const badgeSize = Math.round(12 * scale);
  const detailsSize = Math.round(13 * scale);
  const padH = Math.round(clamp(width * 0.05, 16, 22));
  const padV = Math.round(16 * scale);

  const display = points.toLocaleString('en-US');

  return (
    <LinearGradient
      colors={['#A636F2', '#40128C']}
      start={{ x: rtl ? 1 : 0, y: 0.5 }}
      end={{ x: rtl ? 0 : 1, y: 0.5 }}
      style={[styles.card, { paddingHorizontal: padH, paddingVertical: padV }]}
    >
      <View style={[styles.body, rtl ? styles.rowRtl : styles.row]}>
        <View style={[styles.pointsCol, rtl ? styles.alignEnd : styles.alignStart]}>
          <Text
            style={[styles.title, { fontFamily: titleFont, fontSize: titleSize, lineHeight: titleSize + 4 }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.value,
              {
                fontSize: valueSize,
                lineHeight: valueSize + 4,
                letterSpacing: display.length > 3 ? 0.5 : 1.5,
              },
            ]}
            numberOfLines={1}
            allowFontScaling={false}
            accessibilityRole="text"
            accessibilityLabel={`${points} ${unit}`}
          >
            {display}
          </Text>
          <Text
            style={[styles.unit, { fontFamily: bodyFont, fontSize: unitSize, lineHeight: unitSize + 3 }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.15}
          >
            {unit}
          </Text>
        </View>

        <View style={[styles.sideCol, rtl ? styles.alignStart : styles.alignEnd]}>
          <View style={styles.badge}>
            <Text
              style={[styles.badgeText, { fontFamily: bodyFont, fontSize: badgeSize }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.15}
            >
              {leagueCount}
            </Text>
          </View>
          {onDetails ? (
            <TouchableOpacity
              onPress={onDetails}
              accessibilityRole="button"
              hitSlop={8}
              style={[styles.details, rtl ? styles.rowRtl : styles.row]}
            >
              <Text
                style={[styles.detailsText, { fontFamily: bodyFont, fontSize: detailsSize }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.15}
              >
                {detailsLabel}
              </Text>
              <Ionicons
                name={rtl ? 'chevron-back' : 'chevron-forward'}
                size={Math.round(15 * scale)}
                color="rgba(255,255,255,0.92)"
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
}

export function TsfIslandBack({
  onPress,
  label,
  rtl: _rtl,
  light,
}: {
  onPress: () => void;
  label: string;
  /** Kept for callers; the control stays on the left in both languages. */
  rtl?: boolean;
  light?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.island, styles.islandStart, light && styles.islandOnDark]}
    >
      <Ionicons name="chevron-back" size={22} color={light ? '#FFFFFF' : '#24104E'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  body: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowRtl: { flexDirection: 'row-reverse', alignItems: 'center' },
  pointsCol: {
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  sideCol: {
    flexShrink: 0,
    gap: 14,
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: 2,
  },
  alignStart: { alignItems: 'flex-start' },
  alignEnd: { alignItems: 'flex-end' },
  title: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
  },
  value: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  unit: {
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '500',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  details: {
    gap: 2,
  },
  detailsText: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '500',
  },
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
});
