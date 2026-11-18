import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { CkCoach, CkPlayer } from '../../services/coachKing.service';
import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import { useAppFont } from '../../utils/fontSetup';
import { getCoachKingTheme, type CoachKingTheme } from './theme';

const PITCH = require('../../assets/images/top-scorers-five/pitch.jpg');
const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');
const DESIGN_WIDTH = 448;
const GOLD = '#F8C94A';
const AVATAR_BLOB = '#E7DBFF';

export const CK_ROWS = [
  ['lw', 'st', 'rw'],
  ['cm1', 'cm2', 'cm3'],
  ['lb', 'cb1', 'cb2', 'rb'],
  ['gk'],
] as const;

const ROW_GAP = [38, 24, 8, 0];

const LABELS: Record<string, string> = {
  lw: 'LW', st: 'ST', rw: 'RW', cm1: 'CM', cm2: 'CM', cm3: 'CM',
  lb: 'LB', cb1: 'CB', cb2: 'CB', rb: 'RB', gk: 'GK',
};

export type CkPitchSlot = { slotKey: string; player: CkPlayer; locked?: boolean; points?: number };
export type CkPitchCoach = CkCoach & { locked?: boolean };

type Props = {
  slots: CkPitchSlot[];
  coach: CkPitchCoach | null;
  coachLabel: string;
  /** Empty-state coach name (Figma pickCoach). */
  pickCoach: string;
  /** Empty-state formation pill (Figma pickFormation). */
  pickFormation: string;
  formation: string;
  isAr: boolean;
  /** Opponent view: no taps on the cards. */
  readOnly?: boolean;
  closed?: boolean;
  onSlot?: (slotKey: string) => void;
  onCoach?: () => void;
};

export function CoachKingPitch({
  slots,
  coach,
  coachLabel,
  pickCoach,
  pickFormation,
  formation,
  isAr,
  readOnly = false,
  closed = false,
  onSlot,
  onCoach,
}: Props) {
  const { width } = useWindowDimensions();
  const s = (value: number) => (value * Math.min(width, 520)) / DESIGN_WIDTH;
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getCoachKingTheme(isDark), [isDark]);
  const byKey = new Map(slots.map((slot) => [slot.slotKey, slot]));
  const row = isAr ? 'row-reverse' : 'row';
  const avatar = s(46);
  const blob = s(56);
  const formationLabel = coach ? formation : pickFormation;
  const coachName = coach?.name ?? pickCoach;
  return (
    <View>
      <Pressable
        style={[
          styles.coachBar,
          {
            flexDirection: row,
            marginHorizontal: s(16),
            borderRadius: s(23),
            paddingVertical: s(12),
            paddingHorizontal: s(14),
            backgroundColor: theme.coachBarBg,
            borderColor: theme.coachBarBorder,
          },
          !isDark ? styles.coachBarLift : null,
        ]}
        onPress={onCoach}
        disabled={readOnly || !onCoach}
        testID="ck-coach"
      >
        <View style={[styles.avatarWrap, { width: blob, height: blob }]}>
          {!isDark ? (
            <View
              style={[
                styles.avatarBlob,
                {
                  width: blob,
                  height: blob,
                  borderRadius: blob / 2,
                  backgroundColor: AVATAR_BLOB,
                },
              ]}
            />
          ) : null}
          <Image
            source={coach?.photo ? { uri: coach.photo } : PLACEHOLDER}
            style={[
              styles.coachPhoto,
              {
                width: avatar,
                height: avatar,
                borderRadius: avatar / 2,
              },
            ]}
            cachePolicy="memory-disk"
          />
        </View>
        <View style={[styles.coachCopy, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}>
          <Text style={[styles.coachHint, { fontFamily: fontMed, fontSize: s(11), color: theme.coachHint }]}>{coachLabel}</Text>
          <Text style={[styles.coachName, { fontFamily: fontSemi, fontSize: s(16), color: theme.ink }]} numberOfLines={1}>
            {coachName}
          </Text>
        </View>
        {coach?.teamLogo ? (
          <Image source={{ uri: coach.teamLogo }} style={{ width: s(24), height: s(24) }} contentFit="contain" cachePolicy="memory-disk" />
        ) : null}
        {coach?.locked ? <LockBadge size={s(20)} /> : null}
        <View
          style={[
            styles.formation,
            {
              height: s(28),
              paddingHorizontal: s(12),
              columnGap: s(4),
              backgroundColor: theme.formationBg,
              borderColor: theme.formationBorder,
            },
          ]}
        >
          <Text style={[styles.formationTxt, { fontFamily: fontSemi, fontSize: s(11), color: theme.formationText }]} numberOfLines={1}>
            {formationLabel}
          </Text>
          <MaterialCommunityIcons name="soccer-field" size={s(14)} color={theme.formationText} />
        </View>
      </Pressable>

      <View style={[styles.pitchWrap, { marginTop: s(14), minHeight: s(600) }]}>
        <Image source={PITCH} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={[...theme.pitchFade]}
          locations={[0, 0.28, 0.78, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ paddingTop: s(30), rowGap: s(26) }}>
          {CK_ROWS.map((keys, index) => (
            <View key={keys.join('-')} style={[styles.row, { columnGap: s(ROW_GAP[index] ?? 8) }]}>
              {keys.map((key) => (
                <SlotCard
                  key={key}
                  slotKey={key}
                  slot={byKey.get(key) ?? null}
                  s={s}
                  readOnly={readOnly}
                  closed={closed}
                  fontSemi={fontSemi}
                  theme={theme}
                  onPress={onSlot}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

type SlotCardProps = {
  slotKey: string;
  slot: CkPitchSlot | null;
  s: (value: number) => number;
  readOnly: boolean;
  closed: boolean;
  fontSemi: string;
  theme: CoachKingTheme;
  onPress?: (slotKey: string) => void;
};

const SlotCard = memo(function SlotCard({ slotKey, slot, s, readOnly, closed, fontSemi, theme, onPress }: SlotCardProps) {
  const player = slot?.player ?? null;
  const locked = slot?.locked === true;
  const cardW = s(97);
  const face = s(52);
  const ptsH = s(18);
  const ptsGap = s(4);
  // Room above the face so the week-points pill sits over the player photo.
  const ptsBand = player ? ptsH + ptsGap : 0;
  const faceTop = ptsBand;
  const showPoints = Boolean(player) && slot?.points != null;
  return (
    <Pressable
      style={({ pressed }) => [
        { width: cardW, height: s(80) + face / 2 + ptsBand, alignItems: 'center' },
        pressed && !readOnly ? { opacity: 0.88, transform: [{ scale: 0.97 }] } : null,
      ]}
      onPress={() => onPress?.(slotKey)}
      disabled={readOnly || !onPress || (closed && !locked)}
      testID={`ck-slot-${slotKey}`}
      accessibilityRole="button"
      accessibilityLabel={player ? `${LABELS[slotKey]} ${player.name}` : LABELS[slotKey]}
    >
      {showPoints ? (
        <View
          style={[
            styles.points,
            {
              top: 0,
              height: ptsH,
              paddingHorizontal: s(7),
              borderRadius: s(9),
              backgroundColor: theme.pointsPill,
            },
          ]}
          testID={`ck-slot-points-${slotKey}`}
        >
          <Text style={[styles.pointsTxt, { fontFamily: fontSemi, fontSize: s(10) }]}>{slot!.points}</Text>
        </View>
      ) : null}
      <View
        style={[
          styles.card,
          {
            marginTop: faceTop + face / 2,
            width: cardW,
            height: s(80),
            borderRadius: s(16),
            paddingBottom: s(8),
            rowGap: s(5),
            backgroundColor: theme.slotCardBg,
            borderColor: theme.slotCardBorder,
          },
          locked && styles.cardLocked,
        ]}
      >
        <Text style={[styles.cardName, { fontFamily: fontSemi, fontSize: s(12), color: theme.slotName }]} numberOfLines={1}>
          {player ? shortName(player.name) : LABELS[slotKey]}
        </Text>
        <View
          style={[
            styles.pos,
            {
              minWidth: s(36),
              height: s(14),
              borderRadius: s(64),
              backgroundColor: theme.slotPosBg,
              borderColor: theme.slotPosBorder,
            },
          ]}
        >
          <Text style={[styles.posTxt, { fontFamily: fontSemi, fontSize: s(9), color: theme.slotPosText }]}>{LABELS[slotKey]}</Text>
        </View>
      </View>
      <View
        style={[
          styles.face,
          {
            top: faceTop,
            width: face,
            height: face,
            borderRadius: face / 2,
            backgroundColor: theme.faceBg,
            borderColor: theme.faceBorder,
          },
          locked && { borderColor: GOLD },
        ]}
      >
        {player?.photo ? (
          <Image source={{ uri: player.photo }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" cachePolicy="memory-disk" recyclingKey={player.id} />
        ) : (
          <Ionicons name={readOnly ? 'person' : 'add'} size={s(24)} color={theme.faceIcon} />
        )}
      </View>
      {player?.shirtNumber != null ? (
        <View
          style={[
            styles.number,
            {
              top: faceTop + face * 0.62,
              left: s(14),
              minWidth: s(18),
              height: s(18),
              borderRadius: s(9),
              backgroundColor: theme.numberBg,
            },
          ]}
        >
          <Text style={[styles.numberTxt, { fontFamily: fontSemi, fontSize: s(9), color: theme.numberText }]}>{player.shirtNumber}</Text>
        </View>
      ) : null}
      {locked && !readOnly ? (
        <View style={{ position: 'absolute', top: faceTop + face * 0.52, right: s(12) }}>
          <LockBadge size={s(18)} />
        </View>
      ) : null}
    </Pressable>
  );
});

function LockBadge({ size }: { size: number }) {
  return (
    <LinearGradient
      colors={['#FFE08A', GOLD, '#B8730A']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[styles.lock, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Ionicons name="lock-closed" size={size * 0.55} color="#3B2100" />
    </LinearGradient>
  );
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 && name.length > 12 ? parts[parts.length - 1]! : name;
}

const styles = StyleSheet.create({
  coachBar: {
    borderWidth: 1,
    alignItems: 'center',
    columnGap: 12,
  },
  coachBarLift: {
    shadowColor: '#1A0A3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  formation: {
    borderRadius: 48,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 160,
  },
  formationTxt: {},
  coachCopy: { flex: 1 },
  coachHint: {},
  coachName: { marginTop: 2 },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBlob: {
    position: 'absolute',
  },
  coachPhoto: { backgroundColor: 'rgba(128,59,69,0.5)' },
  pitchWrap: { overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'center' },
  card: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  cardLocked: {
    borderColor: 'rgba(248,201,74,0.75)',
    boxShadow: '0px 0px 12px rgba(248,201,74,0.35)',
  },
  cardName: { paddingHorizontal: 4 },
  pos: {
    paddingHorizontal: 6,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posTxt: {},
  face: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  number: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  numberTxt: {},
  lock: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0B0518',
  },
  points: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pointsTxt: { color: '#fff' },
});
