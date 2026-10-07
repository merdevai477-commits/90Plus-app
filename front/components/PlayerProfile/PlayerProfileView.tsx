import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type RefreshControlProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Player365LastMatch } from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n';
import { getCountryFlagUri } from '../../utils/countryFlagUri';
import { useAppFont } from '../../utils/fontSetup';
import { toFullscreenPhotoUrl } from '../../utils/scores365AthletePhoto';
import ImageViewerModal from '../common/ImageViewerModal';
import TeamBadge from '../common/TeamBadge';
import GradientText from '../ShareWin/components/GradientText';
import { PP_ICON, PP_STADIUM } from './assets';
import { PP_COLORS as C, ratingTone } from './theme';
import type { PlayerProfileTab, PlayerProfileViewModel, PlayerTransferRow } from './types';

const DESIGN_WIDTH = 448;
const STRIP_OVERLAP = 41;

function useRtl() {
  const { language } = useTranslation();
  return language === 'ar';
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

function fmtMatchDate(iso: string | null, rtl: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return rtl ? `${yyyy} - ${mm} - ${dd}` : `${dd} - ${mm} - ${yyyy}`;
}

export function PlayerProfileHeader({ onBack, onBell }: { onBack: () => void; onBell?: () => void }) {
  const insets = useSafeAreaInsets();
  const fontBold = useAppFont(700);
  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.headerBtn} accessibilityRole="button">
        <Image source={PP_ICON.arrowBack} style={styles.headerIcon} contentFit="contain" />
      </Pressable>
      <View style={styles.brand}>
        <Text style={[styles.brandNinety, { fontFamily: fontBold }]} allowFontScaling={false}>
          90{' '}
        </Text>
        <GradientText
          colors={['#a78bfa', '#7c3aed']}
          style={[styles.brandNinety, { fontFamily: fontBold }]}
        >
          PLUS
        </GradientText>
      </View>
      <Pressable
        onPress={onBell}
        hitSlop={10}
        style={[styles.headerBtn, styles.headerBtnEnd]}
        accessibilityRole="button"
        disabled={!onBell}
      >
        <Image source={PP_ICON.bell} style={styles.headerIcon} contentFit="contain" />
      </Pressable>
    </View>
  );
}

export function PlayerProfileStatus({
  loading,
  message,
  actionLabel,
  onBack,
}: {
  loading?: boolean;
  message: string;
  actionLabel?: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <PlayerProfileHeader onBack={onBack} />
      <View style={styles.statusBody}>
        {loading ? (
          <ActivityIndicator size="large" color={C.primary} />
        ) : (
          <Ionicons name="cloud-offline-outline" size={48} color={C.muted} />
        )}
        <Text style={styles.statusText}>{message}</Text>
        {!loading && actionLabel ? (
          <Pressable style={styles.statusBtn} onPress={onBack}>
            <Text style={styles.statusBtnText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface PlayerProfileViewProps {
  vm: PlayerProfileViewModel;
  statsContent?: ReactNode;
  initialTab?: PlayerProfileTab;
  refreshControl?: ReactElement<RefreshControlProps>;
  onBack: () => void;
  onBell?: () => void;
}

export default function PlayerProfileView({
  vm,
  statsContent,
  initialTab = 'overview',
  refreshControl,
  onBack,
  onBell,
}: PlayerProfileViewProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const rtl = useRtl();
  const { t } = useTranslation();
  const pc = t.playerCareer;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);

  const [tab, setTab] = useState<PlayerProfileTab>(initialTab);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    setPhotoIndex(0);
  }, [vm.photoKey]);

  const scale = Math.min(width / DESIGN_WIDTH, 1.1);
  const heroHeight = Math.round(306 * scale);
  const pad = width < 400 ? 16 : 22;
  const row = rtl ? 'row-reverse' : 'row';
  const textStart = rtl ? 'right' : 'left';
  const alignStart = rtl ? 'flex-end' : 'flex-start';

  const photoUri = vm.photoCandidates[photoIndex];
  const photoFailed = photoIndex >= vm.photoCandidates.length;
  const flagUri = vm.nationality ? getCountryFlagUri(vm.nationality, null, 80) : null;

  const tabs: { key: PlayerProfileTab; label: string }[] = [
    { key: 'stats', label: pc.tabStats },
    { key: 'overview', label: pc.tabOverview },
    { key: 'chats', label: pc.tabChats },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <PlayerProfileHeader onBack={onBack} onBell={onBell} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Hero */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image source={PP_STADIUM} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, styles.heroTint]} />
          {vm.jerseyNumber != null ? (
            <Text
              style={[
                styles.heroJersey,
                { fontFamily: fontBold, fontSize: 150 * scale },
                rtl ? { left: pad } : { right: pad },
              ]}
              allowFontScaling={false}
            >
              {`#${vm.jerseyNumber}`}
            </Text>
          ) : null}
          <Pressable
            style={[styles.heroPhotoWrap, rtl ? { left: 0 } : { right: 0 }]}
            onPress={() => photoUri && !photoFailed && setViewerOpen(true)}
            accessibilityRole="imagebutton"
          >
            {photoUri && !photoFailed ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.heroPhoto}
                contentFit="contain"
                contentPosition="bottom"
                cachePolicy="memory-disk"
                priority="high"
                transition={0}
                recyclingKey={`${vm.photoKey}-${photoIndex}`}
                onError={() =>
                  setPhotoIndex((i) =>
                    i + 1 < vm.photoCandidates.length ? i + 1 : vm.photoCandidates.length,
                  )
                }
              />
            ) : (
              <View style={styles.heroPhotoFallback}>
                <Ionicons name="person" size={72} color="rgba(255,255,255,0.25)" />
              </View>
            )}
          </Pressable>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(3,3,3,0.92)', 'rgba(3,3,3,0.55)', 'rgba(3,3,3,0)']}
            locations={[0, 0.45, 0.8]}
            start={{ x: rtl ? 1 : 0, y: 0.5 }}
            end={{ x: rtl ? 0 : 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(3,3,3,0)', C.bg]}
            style={styles.heroBottomFade}
          />

          <View
            style={[
              styles.heroText,
              { paddingHorizontal: pad, alignItems: alignStart, paddingBottom: STRIP_OVERLAP + 18 },
              rtl ? { right: 0 } : { left: 0 },
            ]}
          >
            {vm.nationality ? (
              <View style={[styles.inlineRow, { flexDirection: row }]}>
                <Text style={[styles.heroNationality, { fontFamily: fontSemi }]} numberOfLines={1}>
                  {vm.nationality}
                </Text>
                {flagUri ? (
                  <Image source={{ uri: flagUri }} style={styles.flag} contentFit="cover" />
                ) : null}
              </View>
            ) : null}
            <View style={[styles.inlineRow, { flexDirection: row, marginTop: 4 }]}>
              <Text
                style={[styles.heroName, { fontFamily: fontBold, fontSize: 28 * Math.min(scale, 1), textAlign: textStart }]}
                numberOfLines={2}
              >
                {vm.name}
              </Text>
              <Image source={PP_ICON.verified} style={styles.verified} contentFit="contain" />
            </View>
            {vm.clubName ? (
              <View style={[styles.inlineRow, { flexDirection: row, marginTop: 6 }]}>
                <Text style={[styles.heroClub, { fontFamily: fontSemi }]} numberOfLines={1}>
                  {vm.clubName}
                </Text>
                <TeamBadge name={vm.clubName} logo={vm.clubLogo || undefined} size={22} color="transparent" />
              </View>
            ) : null}
            <Pressable
              disabled
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              style={styles.followWrap}
            >
              <LinearGradient
                colors={[C.primary, '#2e146a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.followBtn, { flexDirection: row }]}
              >
                <Image source={PP_ICON.star} style={styles.followIcon} contentFit="contain" />
                <Text style={[styles.followText, { fontFamily: fontBold }]}>{pc.follow}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        {/* Info strip */}
        <View style={[styles.strip, { marginHorizontal: pad, flexDirection: row }]}>
          <InfoCell
            label={pc.nationality}
            value={vm.nationality || '—'}
            leading={flagUri ? <Image source={{ uri: flagUri }} style={styles.flag} contentFit="cover" /> : null}
            rtl={rtl}
          />
          <View style={styles.stripDivider} />
          <InfoCell
            label={pc.age}
            value={vm.age != null ? `${vm.age} ${pc.years}` : '—'}
            leading={<Image source={PP_ICON.cake} style={styles.infoIcon} contentFit="contain" />}
            rtl={rtl}
          />
          <View style={styles.stripDivider} />
          <InfoCell
            label={pc.height}
            value={vm.height || '—'}
            leading={<Image source={PP_ICON.height} style={styles.infoIcon} contentFit="contain" />}
            rtl={rtl}
          />
          <View style={styles.stripDivider} />
          <InfoCell
            label={pc.position}
            value={vm.position || '—'}
            leading={<Image source={PP_ICON.position} style={styles.infoIcon} contentFit="contain" />}
            rtl={rtl}
          />
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { marginHorizontal: pad, flexDirection: row }]}>
          {tabs.map((tb) => {
            const active = tb.key === tab;
            return (
              <Pressable
                key={tb.key}
                style={styles.tab}
                onPress={() => setTab(tb.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { fontFamily: active ? fontBold : fontSemi },
                    active && styles.tabTextActive,
                  ]}
                >
                  {tb.label}
                </Text>
                {active ? (
                  <LinearGradient
                    colors={['rgba(139,92,246,0)', C.primary, 'rgba(139,92,246,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.tabUnderline}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: pad }}>
          {tab === 'overview' ? (
            <OverviewTab vm={vm} rtl={rtl} />
          ) : tab === 'stats' ? (
            statsContent ?? null
          ) : (
            <View style={[styles.card, styles.comingSoon]}>
              <Ionicons name="chatbubbles-outline" size={36} color={C.primary} />
              <Text style={[styles.comingSoonText, { fontFamily: fontSemi }]}>{pc.chatsComingSoon}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <ImageViewerModal
        visible={viewerOpen && !!photoUri && !photoFailed}
        imageUrl={toFullscreenPhotoUrl(photoUri) || photoUri || ''}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

function InfoCell({
  label,
  value,
  leading,
  rtl,
}: {
  label: string;
  value: string;
  leading: ReactNode;
  rtl: boolean;
}) {
  const fontBold = useAppFont(700);
  const fontReg = useAppFont(400);
  return (
    <View style={[styles.infoCell, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
      <Text style={[styles.infoLabel, { fontFamily: fontReg }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.inlineRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 5 }]}>
        {leading}
        <Text style={[styles.infoValue, { fontFamily: fontBold }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function SectionHeader({
  icon,
  title,
  trailing,
  rtl,
}: {
  icon: number;
  title: string;
  trailing?: string | null;
  rtl: boolean;
}) {
  const fontBold = useAppFont(700);
  return (
    <View style={[styles.sectionHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
      <View style={[styles.inlineRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }]}>
        <Image source={icon} style={styles.sectionIcon} contentFit="contain" />
        <Text style={[styles.sectionTitle, { fontFamily: fontBold }]}>{title}</Text>
      </View>
      {trailing ? (
        <Text style={[styles.sectionTrailing, { fontFamily: fontBold }]}>{trailing}</Text>
      ) : null}
    </View>
  );
}

function OverviewTab({ vm, rtl }: { vm: PlayerProfileViewModel; rtl: boolean }) {
  const { t } = useTranslation();
  const pc = t.playerCareer;
  const row = rtl ? 'row-reverse' : 'row';
  const fontBold = useAppFont(700);
  const fontReg = useAppFont(400);
  const s = vm.season;

  const played = vm.lastMatches.filter((m) => m.played);
  const recent = (played.length ? played : vm.lastMatches).slice(0, 3).reverse();

  return (
    <>
      {s ? (
        <>
          <SectionHeader
            icon={PP_ICON.seasonStats}
            title={pc.seasonStatsTitle}
            trailing={vm.seasonLabel}
            rtl={rtl}
          />
          <View style={styles.card}>
            <View style={[styles.bigStatsRow, { flexDirection: row }]}>
              <BigStat icon={PP_ICON.court} label={pc.statMatches} value={fmtNum(s.matches)} rtl={rtl} />
              <View style={styles.vDivider} />
              <BigStat icon={PP_ICON.goals} label={pc.statGoals} value={fmtNum(s.goals)} rtl={rtl} />
              <View style={styles.vDivider} />
              <BigStat icon={PP_ICON.court} label={pc.statAssists} value={fmtNum(s.assists)} rtl={rtl} />
            </View>
            <View style={styles.hDivider} />
            <View style={[styles.smallStatsRow, { flexDirection: row }]}>
              <SmallStat
                leading={<Image source={PP_ICON.time} style={styles.smallIcon} contentFit="contain" />}
                label={pc.minutesPlayed}
                value={fmtNum(s.minutes)}
                rtl={rtl}
              />
              <SmallStat
                leading={<Image source={PP_ICON.goalNet} style={styles.smallIcon} contentFit="contain" />}
                label={pc.shotsOnTarget}
                value={fmtNum(s.shotsOnTarget)}
                rtl={rtl}
              />
              <SmallStat
                leading={<Image source={PP_ICON.sneaker} style={styles.smallIcon} contentFit="contain" />}
                label={pc.chancesCreated}
                value={fmtNum(s.chancesCreated)}
                rtl={rtl}
              />
              <SmallStat
                leading={
                  <View style={[styles.cardsIcon, { flexDirection: row }]}>
                    <View style={[styles.cardChip, { backgroundColor: '#FACC15' }]} />
                    <View style={[styles.cardChip, { backgroundColor: '#EF4444', marginLeft: -3 }]} />
                  </View>
                }
                label={pc.cardsYellowRed}
                value={`${fmtNum(s.yellowCards)} / ${fmtNum(s.redCards)}`}
                rtl={rtl}
              />
            </View>
          </View>
        </>
      ) : null}

      {recent.length > 0 ? (
        <>
          <SectionHeader icon={PP_ICON.history} title={pc.lastMatches} rtl={rtl} />
          <View style={[styles.card, styles.matchesCard, { flexDirection: row }]}>
            {recent.map((m) => (
              <LastMatchCell key={m.gameId} match={m} rtl={rtl} dnpLabel={pc.didNotPlay} />
            ))}
          </View>
        </>
      ) : null}

      {vm.transfers.length > 0 ? (
        <>
          <SectionHeader icon={PP_ICON.transfers} title={pc.transferHistory} rtl={rtl} />
          <View style={[styles.card, styles.transfersCard]}>
            {vm.transfers.slice(0, 8).map((tr, idx, arr) => (
              <TransferItem
                key={tr.key}
                row={tr}
                rtl={rtl}
                first={idx === 0}
                last={idx === arr.length - 1}
                feeLabel={pc.transferFee}
                fontBold={fontBold}
                fontReg={fontReg}
              />
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

function BigStat({ icon, label, value, rtl }: { icon: number; label: string; value: string; rtl: boolean }) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  return (
    <View style={styles.bigStat}>
      <Text style={[styles.bigStatValue, { fontFamily: fontBold }]} allowFontScaling={false}>
        {value}
      </Text>
      <View style={[styles.inlineRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 6 }]}>
        <Image source={icon} style={styles.bigStatIcon} contentFit="contain" />
        <Text style={[styles.bigStatLabel, { fontFamily: fontSemi }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function SmallStat({
  leading,
  label,
  value,
  rtl,
}: {
  leading: ReactNode;
  label: string;
  value: string;
  rtl: boolean;
}) {
  const fontBold = useAppFont(700);
  const fontReg = useAppFont(400);
  return (
    <View style={styles.smallStat}>
      <Text style={[styles.smallStatValue, { fontFamily: fontBold }]} allowFontScaling={false}>
        {value}
      </Text>
      <View style={[styles.inlineRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 3 }]}>
        {leading}
        <Text
          style={[styles.smallStatLabel, { fontFamily: fontReg }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function LastMatchCell({
  match,
  rtl,
  dnpLabel,
}: {
  match: Player365LastMatch;
  rtl: boolean;
  dnpLabel: string;
}) {
  const fontBold = useAppFont(700);
  const fontReg = useAppFont(400);
  const hasRating = match.played && match.rating != null;
  return (
    <View style={styles.matchCell}>
      <View style={[styles.inlineRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }]}>
        <TeamBadge
          name={match.opponentName || '—'}
          logo={match.opponentLogo || undefined}
          size={26}
          color="transparent"
        />
        <View
          style={[
            styles.ratingPill,
            { backgroundColor: hasRating ? ratingTone(match.rating as number) : 'rgba(255,255,255,0.12)' },
          ]}
        >
          <Text
            style={[
              styles.ratingText,
              { fontFamily: fontBold, color: hasRating ? '#0b0518' : C.muted },
            ]}
          >
            {hasRating ? (match.rating as number).toFixed(1) : dnpLabel}
          </Text>
        </View>
      </View>
      <Text style={[styles.matchDate, { fontFamily: fontReg }]}>{fmtMatchDate(match.startTime, rtl)}</Text>
      <Text style={[styles.matchOpponent, { fontFamily: fontBold }]} numberOfLines={1}>
        {match.opponentName || '—'}
      </Text>
    </View>
  );
}

function TransferItem({
  row: tr,
  rtl,
  first,
  last,
  feeLabel,
  fontBold,
  fontReg,
}: {
  row: PlayerTransferRow;
  rtl: boolean;
  first: boolean;
  last: boolean;
  feeLabel: string;
  fontBold: string;
  fontReg: string;
}) {
  const row = rtl ? 'row-reverse' : 'row';
  const textAlign = rtl ? 'right' : 'left';
  const endAlign = rtl ? 'flex-start' : 'flex-end';
  return (
    <View style={[styles.transferRow, { flexDirection: row }]}>
      <View style={styles.timelineCol}>
        <View style={[styles.timelineLine, first && styles.timelineHidden]} />
        <Image
          source={tr.active || first ? PP_ICON.timelineDotActive : PP_ICON.timelineDot}
          style={styles.timelineDot}
          contentFit="contain"
        />
        <View style={[styles.timelineLine, last && styles.timelineHidden]} />
      </View>
      <View style={[styles.transferBody, { flexDirection: row }, !last && styles.transferDivider]}>
        <TeamBadge name={tr.clubName} logo={tr.clubLogo || undefined} size={28} color="transparent" />
        <View style={styles.transferText}>
          <Text style={[styles.transferClub, { fontFamily: fontBold, textAlign }]} numberOfLines={1}>
            {tr.clubName}
          </Text>
          {tr.date ? (
            <Text style={[styles.transferDate, { fontFamily: fontReg, textAlign }]}>{tr.date}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: endAlign }}>
          {tr.price ? (
            <>
              <Text style={[styles.transferPrice, { fontFamily: fontBold }]}>{tr.price}</Text>
              <Text style={[styles.transferFee, { fontFamily: fontReg }]}>{feeLabel}</Text>
            </>
          ) : tr.title ? (
            <Text style={[styles.transferFee, { fontFamily: fontReg }]}>{tr.title}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: C.bar,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: { width: 40, height: 36, justifyContent: 'center' },
  headerBtnEnd: { alignItems: 'flex-end' },
  headerIcon: { width: 24, height: 24 },
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandNinety: { color: '#fff', fontSize: 22 },

  statusBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  statusText: { color: C.soft, fontSize: 14, textAlign: 'center' },
  statusBtn: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  statusBtnText: { color: '#fff', fontWeight: '700' },

  hero: { width: '100%', overflow: 'hidden', backgroundColor: C.bar },
  heroTint: { backgroundColor: 'rgba(12,5,26,0.45)' },
  heroJersey: {
    position: 'absolute',
    top: 0,
    color: C.jersey,
    opacity: 0.9,
  },
  heroPhotoWrap: { position: 'absolute', top: 0, bottom: STRIP_OVERLAP - 6, width: '52%' },
  heroPhoto: { width: '100%', height: '100%' },
  heroPhotoFallback: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24 },
  heroBottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 },
  heroText: { position: 'absolute', top: 0, bottom: 0, width: '60%', justifyContent: 'flex-end' },
  inlineRow: { alignItems: 'center', gap: 6 },
  heroNationality: { color: C.soft, fontSize: 13 },
  flag: { width: 18, height: 12, borderRadius: 2 },
  heroName: { color: '#fff', flexShrink: 1 },
  verified: { width: 22, height: 22 },
  heroClub: { color: C.soft, fontSize: 14, flexShrink: 1 },
  followWrap: { marginTop: 12, alignSelf: 'stretch' },
  followBtn: {
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  followIcon: { width: 16, height: 16 },
  followText: { color: '#fff', fontSize: 14 },

  strip: {
    marginTop: -STRIP_OVERLAP,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  stripDivider: { width: 1, backgroundColor: C.divider, marginVertical: 2 },
  infoCell: { flex: 1, paddingHorizontal: 6, gap: 6 },
  infoLabel: { color: C.muted, fontSize: 12 },
  infoValue: { color: '#fff', fontSize: 14, flexShrink: 1 },
  infoIcon: { width: 15, height: 15 },

  tabs: {
    marginTop: 18,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { color: C.soft, fontSize: 15 },
  tabTextActive: {
    color: C.primary,
    textShadowColor: 'rgba(139,92,246,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tabUnderline: { position: 'absolute', bottom: -1, left: '15%', right: '15%', height: 2, borderRadius: 1 },

  sectionHeader: {
    marginTop: 22,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionIcon: { width: 20, height: 20 },
  sectionTitle: { color: '#fff', fontSize: 17 },
  sectionTrailing: { color: C.primary, fontSize: 15 },

  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
  },
  bigStatsRow: { paddingVertical: 18 },
  bigStat: { flex: 1, alignItems: 'center', gap: 6 },
  bigStatValue: { color: '#fff', fontSize: 26 },
  bigStatIcon: { width: 18, height: 18 },
  bigStatLabel: { color: C.soft, fontSize: 14 },
  vDivider: { width: 1, backgroundColor: C.divider, marginVertical: 6 },
  hDivider: { height: 1, backgroundColor: C.divider, marginHorizontal: 14 },
  smallStatsRow: { paddingVertical: 14, paddingHorizontal: 6 },
  smallStat: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 2 },
  smallStatValue: { color: '#fff', fontSize: 16 },
  smallStatLabel: { color: C.muted, fontSize: 10, flexShrink: 1 },
  smallIcon: { width: 12, height: 12 },
  cardsIcon: { alignItems: 'center' },
  cardChip: { width: 7, height: 10, borderRadius: 1.5 },

  matchesCard: { paddingVertical: 16, paddingHorizontal: 6 },
  matchCell: { flex: 1, alignItems: 'center', gap: 6 },
  ratingPill: { minWidth: 40, paddingHorizontal: 8, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  ratingText: { fontSize: 13 },
  matchDate: { color: C.muted, fontSize: 11, marginTop: 2 },
  matchOpponent: { color: '#fff', fontSize: 14, maxWidth: '95%' },

  transfersCard: { paddingHorizontal: 14, paddingVertical: 4 },
  transferRow: { alignItems: 'stretch' },
  timelineCol: { width: 20, alignItems: 'center' },
  timelineLine: { flex: 1, width: 2, backgroundColor: C.timeline },
  timelineHidden: { backgroundColor: 'transparent' },
  timelineDot: { width: 19, height: 19 },
  transferBody: { flex: 1, alignItems: 'center', gap: 10, paddingVertical: 14, marginHorizontal: 8 },
  transferDivider: { borderBottomWidth: 1, borderBottomColor: C.divider },
  transferText: { flex: 1, minWidth: 0, gap: 3 },
  transferClub: { color: '#fff', fontSize: 14 },
  transferDate: { color: C.muted, fontSize: 12 },
  transferPrice: { color: '#fff', fontSize: 15 },
  transferFee: { color: C.muted, fontSize: 11 },

  comingSoon: { marginTop: 22, paddingVertical: 36, alignItems: 'center', gap: 12 },
  comingSoonText: { color: C.soft, fontSize: 14 },
});
