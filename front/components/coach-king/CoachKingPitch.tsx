import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { CkCoach, CkPlayer } from '../../services/coachKing.service';
import { useAppFont } from '../../utils/fontSetup';

const PITCH = require('../../assets/images/top-scorers-five/pitch.jpg');
const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

export const CK_ROWS = [
  ['lw', 'st', 'rw'],
  ['cm1', 'cm2', 'cm3'],
  ['lb', 'cb1', 'cb2', 'rb'],
  ['gk'],
] as const;

const LABELS: Record<string, string> = {
  lw: 'LW', st: 'ST', rw: 'RW', cm1: 'CM', cm2: 'CM', cm3: 'CM',
  lb: 'LB', cb1: 'CB', cb2: 'CB', rb: 'RB', gk: 'GK',
};

type Slot = { slotKey: string; player: CkPlayer };

type Props = {
  slots: Slot[];
  coach: CkCoach | null;
  confirmed: boolean;
  userName: string;
  avatar: string | null;
  levelLabel: string;
  rankLabel: string;
  budgetLabel: string;
  remainingLabel: string;
  ofLabel: string;
  coachLabel: string;
  formation: string;
  remainingNegative: boolean;
  onSlot: (slotKey: string) => void;
  onCoach: () => void;
  onClear: (slotKey: string) => void;
};

export function CoachKingPitch({
  slots,
  coach,
  confirmed,
  userName,
  avatar,
  levelLabel,
  rankLabel,
  budgetLabel,
  remainingLabel,
  ofLabel,
  coachLabel,
  formation,
  remainingNegative,
  onSlot,
  onCoach,
  onClear,
}: Props) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  const byKey = new Map(slots.map((slot) => [slot.slotKey, slot.player]));

  return (
    <View>
      <View style={styles.profile}>
        <View style={styles.budget}>
          <Text style={[styles.budgetHint, { fontFamily: fontMed }]}>{budgetLabel}</Text>
          <Text style={[styles.budgetValue, { fontFamily: fontBold, color: remainingNegative ? '#F87171' : '#fff' }]}>
            {remainingLabel}
          </Text>
          <Text style={[styles.budgetHint, { fontFamily: fontMed }]}>{ofLabel}</Text>
        </View>
        <View style={styles.identity}>
          <View style={{ alignItems: 'flex-end', flex: 1 }}>
            <Text style={[styles.userName, { fontFamily: fontSemi }]} numberOfLines={1}>{userName}</Text>
            <Text style={[styles.meta, { fontFamily: fontMed }]} numberOfLines={1}>{levelLabel}   {rankLabel}</Text>
          </View>
          <Image source={avatar ? { uri: avatar } : PLACEHOLDER} style={styles.avatar} />
        </View>
      </View>

      <Pressable style={styles.coachBar} onPress={onCoach} disabled={confirmed} testID="ck-coach">
        <View style={styles.formation}>
          <Text style={[styles.formationTxt, { fontFamily: fontSemi }]}>{formation}</Text>
        </View>
        <View style={styles.coachCopy}>
          <Text style={[styles.coachHint, { fontFamily: fontMed }]}>{coachLabel}</Text>
          <Text style={[styles.coachName, { fontFamily: fontSemi }]} numberOfLines={1}>
            {coach?.name ?? '—'}
          </Text>
        </View>
        <Image source={coach?.photo ? { uri: coach.photo } : PLACEHOLDER} style={styles.coachPhoto} />
      </Pressable>

      <View style={styles.pitchWrap}>
        <Image source={PITCH} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['rgba(3,3,3,0.15)', 'rgba(3,3,3,0.35)', 'rgba(3,3,3,0.72)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.rows}>
          {CK_ROWS.map((row) => (
            <View key={row.join('-')} style={styles.row}>
              {row.map((key) => {
                const player = byKey.get(key);
                return (
                  <Pressable
                    key={key}
                    style={styles.cardHit}
                    onPress={() => onSlot(key)}
                    disabled={confirmed}
                    testID={`ck-slot-${key}`}
                  >
                    <View style={styles.card}>
                      <Text style={[styles.cardName, { fontFamily: fontSemi }]} numberOfLines={1}>
                        {player?.name ?? LABELS[key]}
                      </Text>
                      <View style={styles.pos}>
                        <Text style={[styles.posTxt, { fontFamily: fontSemi }]}>{LABELS[key]}</Text>
                      </View>
                    </View>
                    <Image
                      source={player?.photo ? { uri: player.photo } : PLACEHOLDER}
                      style={[styles.face, !player && { opacity: 0.35 }]}
                    />
                    <View style={styles.number}>
                      <Text style={[styles.numberTxt, { fontFamily: fontSemi }]}>
                        {player?.shirtNumber ?? ''}
                      </Text>
                    </View>
                    {player && !confirmed ? (
                      <Pressable style={styles.clear} onPress={() => onClear(key)} hitSlop={8}>
                        <Ionicons name="close" size={12} color="#fff" />
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#0A001C',
    borderWidth: 0.5,
    borderColor: '#210F4A',
  },
  budget: { alignItems: 'flex-start', maxWidth: '46%' },
  budgetHint: { color: '#9E9E9E', fontSize: 10 },
  budgetValue: { color: '#fff', fontSize: 20, marginTop: 2 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' },
  userName: { color: '#fff', fontSize: 16 },
  meta: { color: '#9C9C9C', fontSize: 12, marginTop: 4 },
  avatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 0.5, borderColor: '#6E30F5' },
  coachBar: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 23,
    backgroundColor: '#0A001C',
    borderWidth: 0.5,
    borderColor: '#210D4A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  formation: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 48,
    backgroundColor: '#0A001C',
    borderWidth: 0.5,
    borderColor: 'rgba(140,92,246,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formationTxt: { color: '#fff', fontSize: 10 },
  coachCopy: { flex: 1, alignItems: 'flex-end' },
  coachHint: { color: '#C2ABFC', fontSize: 11 },
  coachName: { color: '#fff', fontSize: 16, marginTop: 2 },
  coachPhoto: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(128,59,69,0.5)' },
  pitchWrap: {
    marginTop: 14,
    minHeight: 560,
    overflow: 'hidden',
  },
  rows: { paddingTop: 36, paddingHorizontal: 8, gap: 28 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  cardHit: { width: 86, height: 104, alignItems: 'center' },
  card: {
    marginTop: 24,
    width: 86,
    height: 78,
    borderRadius: 16,
    backgroundColor: '#0A0517',
    borderWidth: 1,
    borderColor: 'rgba(168,84,247,0.31)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    gap: 6,
  },
  cardName: { color: '#fff', fontSize: 11, paddingHorizontal: 4 },
  pos: {
    minWidth: 36,
    height: 14,
    paddingHorizontal: 6,
    borderRadius: 64,
    backgroundColor: '#030214',
    borderWidth: 0.5,
    borderColor: '#352163',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posTxt: { color: '#fff', fontSize: 10 },
  face: {
    position: 'absolute',
    top: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(128,59,69,0.5)',
  },
  number: {
    position: 'absolute',
    top: 28,
    left: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#00071C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  numberTxt: { color: '#fff', fontSize: 10 },
  clear: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
