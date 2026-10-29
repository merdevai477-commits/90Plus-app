import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { CkCoach, CkPlayer } from '../../services/coachKing.service';
import { useAppFont } from '../../utils/fontSetup';

const PITCH = require('../../assets/images/top-scorers-five/pitch.jpg');
const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');
const DESIGN_WIDTH = 448;
const GOLD = '#F8C94A';

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
  formation: string;
  isAr: boolean;
  /** Opponent view: no taps on the cards, points on each one. */
  readOnly?: boolean;
  closed?: boolean;
  onSlot?: (slotKey: string) => void;
  onCoach?: () => void;
};

export function CoachKingPitch({ slots, coach, coachLabel, formation, isAr, readOnly = false, closed = false, onSlot, onCoach }: Props) {
  const { width } = useWindowDimensions();
  const s = (value: number) => (value * Math.min(width, 520)) / DESIGN_WIDTH;
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  const byKey = new Map(slots.map((slot) => [slot.slotKey, slot]));
  const row = isAr ? 'row-reverse' : 'row';

  return (
    <View>
      <Pressable
        style={[styles.coachBar, { flexDirection: row, marginHorizontal: s(16), borderRadius: s(23), paddingVertical: s(12), paddingHorizontal: s(14) }]}
        onPress={onCoach}
        disabled={readOnly || !onCoach}
        testID="ck-coach"
      >
        <Image source={coach?.photo ? { uri: coach.photo } : PLACEHOLDER} style={[styles.coachPhoto, { width: s(46), height: s(46), borderRadius: s(14) }]} cachePolicy="memory-disk" />
        <View style={[styles.coachCopy, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}>
          <Text style={[styles.coachHint, { fontFamily: fontMed, fontSize: s(11) }]}>{coachLabel}</Text>
          <Text style={[styles.coachName, { fontFamily: fontSemi, fontSize: s(16) }]} numberOfLines={1}>
            {coach?.name ?? '—'}
          </Text>
        </View>
        {coach?.teamLogo ? (
          <Image source={{ uri: coach.teamLogo }} style={{ width: s(24), height: s(24) }} contentFit="contain" cachePolicy="memory-disk" />
        ) : null}
        {coach?.locked ? <LockBadge size={s(20)} /> : null}
        <View style={[styles.formation, { height: s(28), paddingHorizontal: s(10) }]}>
          <Text style={[styles.formationTxt, { fontFamily: fontSemi, fontSize: s(11) }]}>{formation}</Text>
        </View>
      </Pressable>

      <View style={[styles.pitchWrap, { marginTop: s(14), minHeight: s(600) }]}>
        <Image source={PITCH} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['rgba(46,20,106,0.35)', 'rgba(3,3,3,0.25)', 'rgba(3,3,3,0)', '#030303']}
          locations={[0, 0.35, 0.8, 1]}
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
  onPress?: (slotKey: string) => void;
};

const SlotCard = memo(function SlotCard({ slotKey, slot, s, readOnly, closed, fontSemi, onPress }: SlotCardProps) {
  const player = slot?.player ?? null;
  const locked = slot?.locked === true;
  const cardW = s(97);
  const face = s(52);
  return (
    <Pressable
      style={({ pressed }) => [
        { width: cardW, height: s(80) + face / 2, alignItems: 'center' },
        pressed && !readOnly ? { opacity: 0.88, transform: [{ scale: 0.97 }] } : null,
      ]}
      onPress={() => onPress?.(slotKey)}
      disabled={readOnly || !onPress || (closed && !locked)}
      testID={`ck-slot-${slotKey}`}
      accessibilityRole="button"
      accessibilityLabel={player ? `${LABELS[slotKey]} ${player.name}` : LABELS[slotKey]}
    >
      <View
        style={[
          styles.card,
          {
            marginTop: face / 2,
            width: cardW,
            height: s(80),
            borderRadius: s(16),
            paddingBottom: s(8),
            rowGap: s(5),
          },
          locked && styles.cardLocked,
        ]}
      >
        <Text style={[styles.cardName, { fontFamily: fontSemi, fontSize: s(12) }]} numberOfLines={1}>
          {player ? shortName(player.name) : LABELS[slotKey]}
        </Text>
        <View style={[styles.pos, { minWidth: s(36), height: s(14), borderRadius: s(64) }]}>
          <Text style={[styles.posTxt, { fontFamily: fontSemi, fontSize: s(9) }]}>{LABELS[slotKey]}</Text>
        </View>
      </View>
      <View style={[styles.face, { width: face, height: face, borderRadius: face / 2 }, locked && { borderColor: GOLD }]}>
        {player?.photo ? (
          <Image source={{ uri: player.photo }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" cachePolicy="memory-disk" recyclingKey={player.id} />
        ) : (
          <Ionicons name={readOnly ? 'person' : 'add'} size={s(24)} color="rgba(255,255,255,0.75)" />
        )}
      </View>
      {player?.shirtNumber != null ? (
        <View style={[styles.number, { top: face * 0.62, left: s(14), minWidth: s(18), height: s(18), borderRadius: s(9) }]}>
          <Text style={[styles.numberTxt, { fontFamily: fontSemi, fontSize: s(9) }]}>{player.shirtNumber}</Text>
        </View>
      ) : null}
      {locked && !readOnly ? (
        <View style={{ position: 'absolute', top: face * 0.52, right: s(12) }}>
          <LockBadge size={s(18)} />
        </View>
      ) : null}
      {readOnly && player && slot?.points != null ? (
        <View style={[styles.points, { top: face * 0.5, right: s(8), height: s(18), paddingHorizontal: s(6), borderRadius: s(9) }]}>
          <Text style={[styles.pointsTxt, { fontFamily: fontSemi, fontSize: s(10) }]}>{slot.points}</Text>
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
    backgroundColor: '#0A001C',
    borderWidth: 0.5,
    borderColor: '#210D4A',
    alignItems: 'center',
    columnGap: 12,
  },
  formation: {
    borderRadius: 48,
    backgroundColor: '#0A001C',
    borderWidth: 0.5,
    borderColor: 'rgba(140,92,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formationTxt: { color: '#fff' },
  coachCopy: { flex: 1 },
  coachHint: { color: '#C2ABFC' },
  coachName: { color: '#fff', marginTop: 2 },
  coachPhoto: { backgroundColor: 'rgba(128,59,69,0.5)' },
  pitchWrap: { overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'center' },
  card: {
    backgroundColor: '#0B0518',
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.31)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  cardLocked: {
    borderColor: 'rgba(248,201,74,0.75)',
    boxShadow: '0px 0px 12px rgba(248,201,74,0.35)',
  },
  cardName: { color: '#fff', paddingHorizontal: 4 },
  pos: {
    paddingHorizontal: 6,
    backgroundColor: '#020214',
    borderWidth: 0.5,
    borderColor: '#352164',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posTxt: { color: '#fff' },
  face: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E146A',
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.6)',
  },
  number: {
    position: 'absolute',
    backgroundColor: '#00081B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  numberTxt: { color: '#fff' },
  lock: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0B0518',
  },
  points: {
    position: 'absolute',
    backgroundColor: '#8C5CF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsTxt: { color: '#fff' },
});
