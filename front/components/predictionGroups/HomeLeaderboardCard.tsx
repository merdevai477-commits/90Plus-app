/**
 * Home-tab leaderboard — dark premium shell + stats CTA.
 */

import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart3, ChevronLeft } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { I18nManager, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { GroupDailyInsight } from '../../services/predictionGroups.service';
import { useTranslation } from '../../src/i18n';
import { GroupMembersSheet } from './GroupMembersSheet';
import { GroupMotivationCard } from './GroupMotivationCard';
import { GroupStatsPopup } from './GroupStatsPopup';
import type { GroupMember } from './data';
import { HomeLeaderboardRow } from './HomeLeaderboardRow';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { PurpleTrophyIcon } from './PurpleTrophyIcon';
import { PG, PG_RADII, usePGFonts } from './theme';

export function HomeLeaderboardCard({
  isRTL,
  members,
  groupStats,
  dailyInsight,
  isOwner,
  onKickMember,
}: {
  isRTL: boolean;
  members: GroupMember[];
  groupStats?: { totalPredictions: number; correctPredictions: number; wrongPredictions: number } | null;
  dailyInsight?: GroupDailyInsight | null;
  isOwner?: boolean;
  onKickMember?: (userId: string) => Promise<void>;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { medium, bold, extra } = usePGFonts();
  const lb = t.predictionGroups.leaderboard;
  const [membersOpen, setMembersOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const top5 = members.slice(0, 5);

  const openMembers = useCallback(() => setMembersOpen(true), []);
  const openStats = useCallback(() => setStatsOpen(true), []);

  const shellGlow = Platform.select({
    ios: {
      shadowColor: PG.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
    },
    android: { elevation: 5 },
    default: {},
  });

  return (
    <>
    <GroupMotivationCard insight={dailyInsight} isRTL={isRTL} />
    <View style={[styles.wrap, shellGlow]}>
      <View style={styles.darkBase}>
        <LinearGradient
          colors={['rgba(4,3,8,0.99)', 'rgba(2,2,5,0.99)', 'rgba(8,5,14,0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(124,58,237,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.content}>
          <View style={[styles.cardHeader, row]}>
            <View style={[styles.titleBlock, row]}>
              <PurpleTrophyIcon size={38} />
              <View>
                <Text style={[styles.title, { fontFamily: extra }]}>{lb.title}</Text>
                <Text style={[styles.subtitle, { fontFamily: medium }]}>{lb.subtitle}</Text>
              </View>
            </View>
            <Pressable onPress={openMembers} hitSlop={8}>
              <Text style={[styles.viewAll, { fontFamily: medium }]}>{lb.viewAll}</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {top5.map((member) => (
            <HomeLeaderboardRow
              key={member.userId ?? member.name}
              member={member}
              isRTL={isRTL}
              onPress={
                member.username
                  ? () => router.push(`/user/${member.username}` as never)
                  : undefined
              }
            />
          ))}

          <LiquidGlassSurface
            borderRadius={PG_RADII.lg}
            style={styles.statsCtaShell}
            onPress={openStats}
            accessibilityLabel={lb.statsCta}
          >
            <View style={[styles.statsCta, row]}>
              <View style={[styles.statsCtaLeft, row]}>
                <BarChart3 size={20} color={PG.primaryLight} />
                <Text style={[styles.statsCtaText, { fontFamily: bold }]}>{lb.statsCta}</Text>
              </View>
              <ChevronLeft
                size={18}
                color={PG.textMuted}
                style={I18nManager.isRTL ? undefined : { transform: [{ rotate: '180deg' }] }}
              />
            </View>
          </LiquidGlassSurface>
        </View>
      </View>

      <GroupMembersSheet
        visible={membersOpen}
        onClose={() => setMembersOpen(false)}
        isRTL={isRTL}
        members={members}
        isOwner={isOwner}
        onKickMember={onKickMember}
      />

      <GroupStatsPopup
        visible={statsOpen}
        onClose={() => setStatsOpen(false)}
        isRTL={isRTL}
        stats={groupStats}
      />
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12 },
  darkBase: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
  },
  content: { padding: 16 },
  cardHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleBlock: { alignItems: 'center', gap: 10, flex: 1 },
  title: { fontSize: 17, lineHeight: 24, color: PG.text, includeFontPadding: false },
  subtitle: { fontSize: 12, lineHeight: 17, color: PG.textMuted, marginTop: 2, includeFontPadding: false },
  viewAll: { fontSize: 12, lineHeight: 17, color: PG.primaryLight, includeFontPadding: false },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 10,
  },
  statsCtaShell: {
    marginTop: 10,
  },
  statsCta: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  statsCtaLeft: { alignItems: 'center', gap: 10 },
  statsCtaText: { color: PG.text, fontSize: 14, lineHeight: 20, includeFontPadding: false },
});
