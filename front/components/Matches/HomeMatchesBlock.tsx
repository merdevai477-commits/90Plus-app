import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Star, Bell, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SectionHeader } from './SectionHeader';
import { PURPLE_PRIMARY, SCREEN_PADDING_H, TEXT_PRIMARY } from '../../constants/tokens';

type MiniFixture = {
  id: string;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  hs: number;
  as: number;
  minute?: string;
  live?: boolean;
};

type MiniLeague = {
  id: string;
  title: string;
  leagueLogo: string;
  rows: MiniFixture[];
};

const MINI_GROUPS: MiniLeague[] = [
  {
    id: 'ucl',
    title: 'UEFA Champions League',
    leagueLogo: 'https://upload.wikimedia.org/wikipedia/en/b/bf/UEFA_Champions_League_logo_2.svg',
    rows: [
      { id: '1', home: 'Real Madrid', away: 'Bayern Munich', homeLogo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg', awayLogo: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg', hs: 2, as: 1, minute: "78'", live: true },
      { id: '2', home: 'Arsenal', away: 'Atlético Madrid', homeLogo: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg', awayLogo: 'https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg', hs: 3, as: 0 },
    ],
  },
  {
    id: 'epl',
    title: 'Premier League',
    leagueLogo: 'https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg',
    rows: [
      { id: '3', home: 'Man City', away: 'Liverpool', homeLogo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg', awayLogo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg', hs: 1, as: 1, minute: "64'", live: true },
      { id: '4', home: 'Tottenham', away: 'Chelsea', homeLogo: 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg', awayLogo: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg', hs: 2, as: 2 },
    ],
  },
];

function MiniRow({ row }: { row: MiniFixture }) {
  const [bellActive, setBellActive] = useState(false);

  return (
    <View style={styles.row}>
      <Star size={14} color="rgba(255,255,255,0.35)" />
      <View style={styles.rowMid}>
        <View style={styles.teamWrap}>
          <View style={styles.teamLogoStub}>
            <Image source={{ uri: row.homeLogo }} style={styles.teamLogo} resizeMode="contain" />
          </View>
          <Text style={styles.team} numberOfLines={1}>{row.home}</Text>
        </View>
        <View style={styles.scoreWrap}>
          {row.live ? <Text style={styles.liveBadge}>LIVE</Text> : <Text style={styles.ftBadge}>FT</Text>}
          <Text style={styles.score}>{row.hs}-{row.as}</Text>
          <Text style={styles.minute}>{row.minute ?? ''}</Text>
        </View>
        <View style={styles.teamWrap}>
          <View style={styles.teamLogoStub}>
            <Image source={{ uri: row.awayLogo }} style={styles.teamLogo} resizeMode="contain" />
          </View>
          <Text style={styles.team} numberOfLines={1}>{row.away}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => setBellActive(!bellActive)} activeOpacity={0.7}>
        <Bell size={14} color={bellActive ? '#fbbf24' : 'rgba(255,255,255,0.35)'} fill={bellActive ? '#fbbf24' : 'transparent'} />
      </TouchableOpacity>
    </View>
  );
}

function MiniLeagueCard({ g }: { g: MiniLeague }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const router = useRouter();

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHead}
        activeOpacity={0.7}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.leagueLeft}>
          <View style={styles.leagueLogoWrap}>
            <Image source={{ uri: g.leagueLogo }} style={styles.leagueLogo} resizeMode="contain" />
          </View>
          <Text style={styles.leagueTitle}>{g.title}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.liveTxt}>Live</Text>
          <ChevronDown
            size={14}
            color="rgba(255,255,255,0.45)"
            style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
          />
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <>
          {g.rows.map((row) => (
            <MiniRow key={row.id} row={row} />
          ))}
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/matches' as any)}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export function HomeMatchesBlock() {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <SectionHeader subtitle="Live & fixtures" title="Live scores" action="View all" onAction={() => router.push('/matches' as any)} />
      <View style={styles.wrap}>
        {MINI_GROUPS.map((g) => (
          <MiniLeagueCard key={g.id} g={g} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 0 },
  wrap: { paddingHorizontal: SCREEN_PADDING_H, gap: 10 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9,7,16,0.94)',
    overflow: 'hidden',
  },
  cardHead: {
    height: 38,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leagueLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  leagueLogoWrap: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  leagueLogo: { width: 12, height: 12 },
  leagueTitle: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  liveTxt: { color: PURPLE_PRIMARY, fontSize: 13, fontWeight: '700' },
  row: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowMid: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamWrap: { width: '34%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamLogoStub: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  teamLogo: { width: 12, height: 12 },
  team: { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '600', flex: 1 },
  scoreWrap: { width: '32%', alignItems: 'center' },
  liveBadge: { color: '#ef4444', fontSize: 10, fontWeight: '800' },
  ftBadge: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800' },
  score: { color: '#fff', fontSize: 20, lineHeight: 22, fontWeight: '900', letterSpacing: -0.5 },
  minute: { color: PURPLE_PRIMARY, fontSize: 11, fontWeight: '700', minHeight: 14 },
  viewAll: {
    textAlign: 'center',
    color: PURPLE_PRIMARY,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 8,
  },
});
