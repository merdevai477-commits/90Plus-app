/**
 * "خماسي الهدافين" locked-pick notice — shown instead of a system alert when
 * the user taps a pick they can no longer change, or when the gameweek has
 * already kicked off. Drawn as an in-screen overlay rather than a `Modal` so
 * it can open while the picker modal is still dismissing on iOS.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

import { TSF_LEAGUE_LOGO, TSF_LOGO_TINT_ON_DARK, type TsfLeagueKey } from './assets';
import { tsfInitials, type TsfPlayer } from './mockData';

const ACTIVE = '#8C5CF5';
const PURPLE_SOFT = '#A78BFA';
const STROKE = '#B896FC';
const LABEL = '#CF9BFC';

export type TsfLockedNotice = {
  /** `confirmed`: the user locked this pick in; `gameweek`: the round has kicked off. */
  readonly reason: 'confirmed' | 'gameweek';
  readonly player?: TsfPlayer;
  readonly league?: TsfLeagueKey;
};

type LockedPickSheetProps = {
  notice: TsfLockedNotice | null;
  scale: number;
  onClose: () => void;
  onViewProfile: (player: TsfPlayer) => void;
};

export function LockedPickSheet({ notice, scale, onClose, onViewProfile }: LockedPickSheetProps) {
  const { t, language } = useTranslation();
  const pickCopy = t.topScorersFive.pick;
  const isAr = language === 'ar';
  const { width } = useWindowDimensions();

  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontRegular = useAppFont(400);

  const s = (value: number) => value * scale;

  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const visible = notice != null;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    lift.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(lift, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, opacity, lift, onClose]);

  if (!notice) return null;

  const { player, league, reason } = notice;
  const canViewProfile = player?.athleteId != null;
  const confirmed = reason === 'confirmed' && player != null;
  const title = confirmed ? pickCopy.pickLockedTitle : pickCopy.lockedTitle;
  const body = confirmed ? pickCopy.pickLockedBody.replace('{name}', player.name) : pickCopy.lockedBody;
  const row = isAr ? 'row-reverse' : 'row';
  const textAlign = isAr ? 'right' : 'left';

  return (
    <Animated.View style={[styles.backdrop, { opacity }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={pickCopy.lockedGotIt}
      />

      <Animated.View
        accessibilityViewIsModal
        testID="tsf-locked-sheet"
        style={[
          styles.sheet,
          {
            width: Math.min(s(392), width - 32),
            borderRadius: s(24),
            paddingHorizontal: s(20),
            paddingTop: s(46),
            paddingBottom: s(20),
            rowGap: s(14),
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [s(24), 0] }) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.lockBadgeRing,
            { top: -s(34), width: s(68), height: s(68), borderRadius: s(34) },
          ]}
        >
          <LinearGradient
            colors={['#A78BFA', ACTIVE, '#5B21B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.lockBadge, { width: s(56), height: s(56), borderRadius: s(28) }]}
          >
            <Ionicons name="lock-closed" size={s(26)} color="#FFFFFF" />
          </LinearGradient>
        </View>

        <TouchableOpacity
          onPress={onClose}
          hitSlop={10}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={pickCopy.close}
          style={[
            styles.closeButton,
            isAr ? { left: s(12) } : { right: s(12) },
            { top: s(12), width: s(30), height: s(30), borderRadius: s(15) },
          ]}
        >
          <Ionicons name="close" size={s(17)} color="#D4D4D8" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', rowGap: s(8) }}>
          <Text
            style={[styles.title, { fontFamily: fontBold, fontSize: s(20), lineHeight: s(28) }]}
            maxFontSizeMultiplier={1.15}
          >
            {title}
          </Text>
          <View
            style={[
              styles.chip,
              { flexDirection: row, columnGap: s(6), paddingHorizontal: s(12), height: s(26), borderRadius: s(13) },
            ]}
          >
            <Ionicons name="time-outline" size={s(13)} color={LABEL} />
            <Text style={[styles.chipText, { fontFamily: fontSemi, fontSize: s(12) }]} maxFontSizeMultiplier={1.1}>
              {pickCopy.lockedUntilNext}
            </Text>
          </View>
        </View>

        {player ? (
          <View style={[styles.playerCard, { borderRadius: s(18), padding: s(12), rowGap: s(12) }]}>
            <View style={{ flexDirection: row, alignItems: 'center', columnGap: s(12) }}>
              <View style={[styles.avatar, { width: s(60), height: s(60), borderRadius: s(30) }]}>
                {player.photo ? (
                  <Image
                    source={{ uri: player.photo }}
                    style={[StyleSheet.absoluteFill, { borderRadius: s(30) }]}
                    contentFit="cover"
                    contentPosition="top"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Text style={[styles.avatarText, { fontFamily: fontBold, fontSize: s(20) }]} allowFontScaling={false}>
                    {tsfInitials(player)}
                  </Text>
                )}
              </View>

              <View style={{ flex: 1, rowGap: s(4) }}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { fontFamily: fontBold, fontSize: s(17), textAlign }]}
                  maxFontSizeMultiplier={1.15}
                >
                  {player.name}
                </Text>
                <View style={{ flexDirection: row, alignItems: 'center', columnGap: s(6) }}>
                  {player.clubLogo ? (
                    <Image
                      source={{ uri: player.clubLogo }}
                      style={{ width: s(16), height: s(16) }}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={[styles.meta, { fontFamily: fontRegular, fontSize: s(13), flexShrink: 1, textAlign }]}
                    maxFontSizeMultiplier={1.15}
                  >
                    {league ? `${player.club} · ${pickCopy.leagues[league]}` : player.club}
                  </Text>
                </View>
              </View>

              {league ? (
                <Image
                  source={TSF_LEAGUE_LOGO[league]}
                  style={{ width: s(26), height: s(30) }}
                  contentFit="contain"
                  tintColor={TSF_LOGO_TINT_ON_DARK[league]}
                />
              ) : null}
            </View>

            {player.points != null ? (
              <View style={{ rowGap: s(8) }}>
                <Text
                  style={[styles.statsCaption, { fontFamily: fontSemi, fontSize: s(11), textAlign }]}
                  maxFontSizeMultiplier={1.1}
                >
                  {pickCopy.gameweekStats}
                </Text>
                <View style={{ flexDirection: row, columnGap: s(8) }}>
                  <Stat
                    icon={<Ionicons name="football" size={s(14)} color="#FFFFFF" />}
                    value={player.goals}
                    label={pickCopy.statGoals}
                    scale={scale}
                    fontBold={fontBold}
                    fontRegular={fontRegular}
                  />
                  <Stat
                    icon={<MaterialCommunityIcons name="shoe-cleat" size={s(14)} color="#FFFFFF" />}
                    value={player.assists}
                    label={pickCopy.statAssists}
                    scale={scale}
                    fontBold={fontBold}
                    fontRegular={fontRegular}
                  />
                  <Stat
                    icon={<Ionicons name="star" size={s(13)} color={LABEL} />}
                    value={player.points}
                    label={pickCopy.statPoints}
                    accent
                    scale={scale}
                    fontBold={fontBold}
                    fontRegular={fontRegular}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text
          style={[styles.body, { fontFamily: fontRegular, fontSize: s(14), lineHeight: s(21) }]}
          maxFontSizeMultiplier={1.15}
        >
          {body}
        </Text>

        <View style={{ alignSelf: 'stretch', rowGap: s(10), marginTop: s(2) }}>
          {player && canViewProfile ? (
            <TouchableOpacity
              onPress={() => onViewProfile(player)}
              activeOpacity={0.85}
              accessibilityRole="button"
              testID="tsf-locked-profile"
              style={[styles.buttonPress, { height: s(50), borderRadius: s(15) }]}
            >
              <LinearGradient
                colors={['#9D74F7', ACTIVE, '#6D3FE0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.primary, { flexDirection: row, columnGap: s(8), borderRadius: s(15) }]}
              >
                <Ionicons name="person-circle-outline" size={s(20)} color="#FFFFFF" />
                <Text style={[styles.primaryText, { fontFamily: fontSemi, fontSize: s(15) }]} maxFontSizeMultiplier={1.15}>
                  {pickCopy.viewProfile}
                </Text>
                <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={s(16)} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            testID="tsf-locked-ok"
            style={[
              styles.secondary,
              { height: s(50), borderRadius: s(15) },
              !(player && canViewProfile) ? styles.secondaryFilled : null,
            ]}
          >
            <Text style={[styles.secondaryText, { fontFamily: fontSemi, fontSize: s(15) }]} maxFontSizeMultiplier={1.15}>
              {pickCopy.lockedGotIt}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

type StatProps = {
  icon: ReactNode;
  value: number;
  label: string;
  accent?: boolean;
  scale: number;
  fontBold: string;
  fontRegular: string;
};

function Stat({ icon, value, label, accent = false, scale, fontBold, fontRegular }: StatProps) {
  const s = (v: number) => v * scale;
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[
        styles.stat,
        accent ? styles.statAccent : null,
        { borderRadius: s(12), paddingVertical: s(8), rowGap: s(2) },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: s(5) }}>
        {icon}
        <Text
          style={[styles.statValue, accent ? { color: LABEL } : null, { fontFamily: fontBold, fontSize: s(17) }]}
          allowFontScaling={false}
        >
          {value}
        </Text>
      </View>
      <Text style={[styles.statLabel, { fontFamily: fontRegular, fontSize: s(11) }]} maxFontSizeMultiplier={1.1}>
        {label}
      </Text>
    </View>
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
    backgroundColor: '#0D081A',
    borderWidth: 0.5,
    borderColor: STROKE,
    boxShadow: '0px 2px 24px rgba(163,77,245,0.45)',
  },
  lockBadgeRing: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D081A',
    borderWidth: 0.5,
    borderColor: STROKE,
    boxShadow: '0px 0px 18px rgba(140,92,245,0.65)',
  },
  lockBadge: { alignItems: 'center', justifyContent: 'center' },
  closeButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  title: { color: '#FFFFFF', textAlign: 'center' },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(140,92,245,0.14)',
    borderWidth: 0.5,
    borderColor: 'rgba(184,150,252,0.45)',
  },
  chipText: { color: LABEL },
  playerCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E146A',
    borderWidth: 1.5,
    borderColor: PURPLE_SOFT,
    overflow: 'hidden',
  },
  avatarText: { color: '#FFFFFF' },
  name: { color: '#FFFFFF' },
  meta: { color: STROKE },
  statsCaption: { color: '#8C8C8C', letterSpacing: 0.3 },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  statAccent: {
    backgroundColor: 'rgba(140,92,245,0.14)',
    borderWidth: 0.5,
    borderColor: 'rgba(184,150,252,0.35)',
  },
  statValue: { color: '#FFFFFF' },
  statLabel: { color: '#9E9E9E' },
  body: { color: '#A1A1AA', textAlign: 'center' },
  buttonPress: { overflow: 'hidden' },
  primary: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF' },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  secondaryFilled: { backgroundColor: ACTIVE, borderColor: ACTIVE },
  secondaryText: { color: '#FFFFFF' },
});
