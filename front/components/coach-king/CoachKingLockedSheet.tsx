/**
 * King of Coaches locked pick: tapping a confirmed slot shows who sits there,
 * what he cost, his gameweek points, and when the lock lifts.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { CoachKingMoney } from './CoachKingCoin';
import { getCoachKingTheme } from './theme';

const ACTIVE = '#8C5CF5';

export type CkLockedNotice = {
  name: string;
  club: string;
  photo: string | null;
  teamLogo: string | null;
  pricePaidMilli: number;
  points: number;
  lockedUntil: string | null;
  canViewProfile: boolean;
};

type Props = {
  notice: CkLockedNotice | null;
  onClose: () => void;
  onViewProfile: () => void;
};

function countdown(until: string | null, units: { days: string; hours: string; minutes: string }, now: number): string {
  if (!until) return '';
  const left = Math.max(0, new Date(until).getTime() - now);
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  if (days > 0) return `${days}${units.days} ${hours}${units.hours}`;
  if (hours > 0) return `${hours}${units.hours} ${minutes}${units.minutes}`;
  return `${minutes}${units.minutes}`;
}

export function CoachKingLockedSheet({ notice, onClose, onViewProfile }: Props) {
  const { t, language } = useTranslation();
  const copy = t.coachKingGame;
  const isAr = language === 'ar';
  const { width } = useWindowDimensions();
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontRegular = useAppFont(400);
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const [now, setNow] = useState(Date.now());
  const visible = notice != null;
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getCoachKingTheme(isDark), [isDark]);

  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    opacity.setValue(0);
    lift.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(lift, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [visible, opacity, lift, onClose]);

  if (!notice) return null;
  const row = isAr ? 'row-reverse' : 'row';
  const textAlign = isAr ? 'right' : 'left';
  const opensIn = countdown(notice.lockedUntil, copy, now);

  return (
    <Animated.View style={[styles.backdrop, { opacity }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.lockedGotIt} />
      <Animated.View
        accessibilityViewIsModal
        testID="ck-locked-sheet"
        style={[
          styles.sheet,
          {
            width: Math.min(392, width - 32),
            backgroundColor: theme.sheetBg,
            borderColor: theme.sheetBorder,
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
      >
        <View style={[styles.lockRing, { backgroundColor: theme.sheetBg, borderColor: theme.sheetBorder }]}>
          <LinearGradient colors={['#A78BFA', ACTIVE, '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={26} color="#FFFFFF" />
          </LinearGradient>
        </View>

        <View style={{ alignItems: 'center', rowGap: 8 }}>
          <Text style={[styles.title, { fontFamily: fontBold, color: theme.sheetTitle }]}>{copy.lockedTitle}</Text>
          {opensIn ? (
            <View style={[styles.chip, { flexDirection: row, backgroundColor: theme.chipBg, borderColor: theme.chipBorder }]}>
              <Ionicons name="time-outline" size={13} color={theme.sheetMeta} />
              <Text style={[styles.chipText, { fontFamily: fontSemi, color: theme.sheetMeta }]}>{copy.lockedOpensIn.replace('{time}', opensIn)}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.sheetCardBg, borderColor: theme.sheetCardBorder }]}>
          <View style={{ flexDirection: row, alignItems: 'center', columnGap: 12 }}>
            <View style={[styles.avatar, { backgroundColor: theme.faceBg, borderColor: theme.secondary }]}>
              {notice.photo ? (
                <Image source={{ uri: notice.photo }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" cachePolicy="memory-disk" />
              ) : (
                <Ionicons name="person" size={26} color={theme.faceIcon} />
              )}
            </View>
            <View style={{ flex: 1, rowGap: 4 }}>
              <Text numberOfLines={1} style={[styles.name, { fontFamily: fontBold, textAlign, color: theme.sheetTitle }]}>{notice.name}</Text>
              <View style={{ flexDirection: row, alignItems: 'center', columnGap: 6 }}>
                {notice.teamLogo ? (
                  <Image source={{ uri: notice.teamLogo }} style={{ width: 16, height: 16 }} contentFit="contain" cachePolicy="memory-disk" />
                ) : null}
                <Text numberOfLines={1} style={[styles.meta, { fontFamily: fontRegular, textAlign, color: theme.sheetMeta }]}>{notice.club}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: row, columnGap: 8 }}>
            <View style={[styles.stat, styles.statAccent, { backgroundColor: theme.chipBg, borderColor: theme.chipBorder }]}>
              <Text style={[styles.statValue, { fontFamily: fontBold, color: theme.sheetMeta }]}>{notice.points}</Text>
              <Text style={[styles.statLabel, { fontFamily: fontRegular, color: theme.subtle }]}>{copy.weekPoints}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: theme.sheetStatBg }]}>
              <CoachKingMoney milli={notice.pricePaidMilli} lang={language} size="md" />
              <Text style={[styles.statLabel, { fontFamily: fontRegular, color: theme.subtle }]}>{copy.paid}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.body, { fontFamily: fontRegular, color: theme.sheetBody }]}>{copy.lockedBody.replace('{name}', notice.name)}</Text>

        <View style={{ alignSelf: 'stretch', rowGap: 10 }}>
          {notice.canViewProfile ? (
            <TouchableOpacity onPress={onViewProfile} activeOpacity={0.85} accessibilityRole="button" style={styles.buttonHit} testID="ck-locked-profile">
              <LinearGradient
                colors={['#9D74F7', ACTIVE, '#6D3FE0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.primary, { flexDirection: row }]}
              >
                <Ionicons name="person-circle-outline" size={20} color="#FFFFFF" />
                <Text style={[styles.primaryText, { fontFamily: fontSemi }]}>{copy.viewProfile}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            testID="ck-locked-ok"
            style={[
              styles.secondary,
              { borderColor: theme.sheetCardBorder },
              !notice.canViewProfile && styles.secondaryFilled,
            ]}
          >
            <Text
              style={[
                styles.primaryText,
                { fontFamily: fontSemi, color: !notice.canViewProfile ? '#FFFFFF' : theme.ink },
              ]}
            >
              {copy.lockedGotIt}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,3,3,0.8)',
    zIndex: 50,
    elevation: 50,
  },
  sheet: {
    alignItems: 'center',
    borderWidth: 0.5,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 46,
    paddingBottom: 20,
    rowGap: 14,
    boxShadow: '0px 2px 24px rgba(163,77,245,0.45)',
  },
  lockRing: {
    position: 'absolute',
    top: -34,
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    boxShadow: '0px 0px 18px rgba(140,92,245,0.65)',
  },
  lockBadge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, textAlign: 'center' },
  chip: {
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 12,
    height: 26,
    borderRadius: 13,
    borderWidth: 0.5,
  },
  chipText: { fontSize: 12 },
  card: {
    alignSelf: 'stretch',
    borderRadius: 18,
    padding: 12,
    rowGap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  name: { fontSize: 17 },
  meta: { fontSize: 13, flexShrink: 1 },
  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 4,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statAccent: { borderWidth: 0.5 },
  statValue: { fontSize: 18 },
  statLabel: { fontSize: 11 },
  body: { textAlign: 'center', fontSize: 14, lineHeight: 21 },
  buttonHit: { height: 50, borderRadius: 15, overflow: 'hidden' },
  primary: { flex: 1, alignItems: 'center', justifyContent: 'center', columnGap: 8 },
  primaryText: { color: '#FFFFFF', fontSize: 15 },
  secondary: {
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryFilled: { backgroundColor: ACTIVE, borderColor: ACTIVE },
});
