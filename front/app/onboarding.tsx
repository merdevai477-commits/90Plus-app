import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import TeamBadge from '../components/common/TeamBadge';
import OnboardingClubCard from '../components/onboarding/OnboardingClubCard';
import { useTranslation } from '../src/i18n';
import { getTeamDisplayName } from '../utils/i18nHelpers';
import ApiFootballService, { type SearchCompetitor365 } from '../services/apiFootball';
import { OnboardingApi } from '../services/onboardingApi';
import { AuthService } from '../src/services/authService';
import { TeamFavoritesStorage } from '../src/storage/teamFavorites.storage';
import { toastManager } from '../services/toastManager';
import {
  MAX_ONBOARDING_TEAMS,
  canSubmitOnboardingPicks,
  toggleOnboardingPick,
  type OnboardingClubPick,
} from '../utils/teamOnboarding';
import { logger } from '../services/logger';
import { releaseLoginInterstitialAfterOnboarding } from '../services/loginInterstitialAd';

/** Figma Team Selection light tokens (1594:4455 / 1594:5015). */
const BG = '#FCFCFC';
const INK = '#24104E';
const MUTED = '#6B7280';
const SUBTLE = '#9CA3AF';
const PRIMARY = '#6A2BD9';
const DARK = '#4B1FA3';
const PROGRESS_IDLE = '#E9D5FF';
const HINT_BG = '#EFE7FD';
const SEARCH_BORDER = '#E5E7EB';
const FOOTER_BORDER = '#F3EDFF';
const BTN_DISABLED_BG = '#DFD5F0';
const BTN_DISABLED_TEXT = '#74648D';

const APP_ICON = require('../assets/images/splash/onboarding-app-icon.png');
const SEARCH_DEBOUNCE_MS = 150;

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function progressLabel(
  count: number,
  copy: {
    progressZero: string;
    progressOne: string;
    progressTwo: string;
    progressThree: string;
  },
): string {
  if (count <= 0) return copy.progressZero;
  if (count === 1) return copy.progressOne;
  if (count === 2) return copy.progressTwo;
  return copy.progressThree;
}

function hintLabel(
  count: number,
  copy: {
    hintNeedThree: string;
    hintNeedTwo: string;
    hintNeedOne: string;
    hintReady: string;
  },
): string {
  if (count <= 0) return copy.hintNeedThree;
  if (count === 1) return copy.hintNeedTwo;
  if (count === 2) return copy.hintNeedOne;
  return copy.hintReady;
}

function ClubRow({
  title,
  showViewAll,
  viewAllLabel,
  clubs,
  selectedIds,
  language,
  isRTL,
  onToggle,
}: {
  title: string;
  showViewAll?: boolean;
  viewAllLabel?: string;
  clubs: OnboardingClubPick[];
  selectedIds: Set<number>;
  language: 'ar' | 'en';
  isRTL: boolean;
  onToggle: (club: OnboardingClubPick) => void;
}) {
  if (clubs.length === 0) return null;
  const visible = clubs.slice(0, 4);
  return (
    <View style={styles.section}>
      {/* Figma: view-all on the left, title+accent on the right (AR). */}
      <View style={styles.sectionHeader}>
        {isRTL ? (
          <>
            {showViewAll && viewAllLabel ? (
              <Text style={styles.viewAll}>{viewAllLabel}</Text>
            ) : (
              <View />
            )}
            <View style={styles.sectionTitleGroup}>
              <Text style={[styles.sectionTitle, styles.textRtl]}>{title}</Text>
              <View style={styles.sectionAccent} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.sectionTitleGroup}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {showViewAll && viewAllLabel ? (
              <Text style={styles.viewAll}>{viewAllLabel}</Text>
            ) : (
              <View />
            )}
          </>
        )}
      </View>
      <View style={styles.row}>
        {visible.map((club) => (
          <View key={club.competitorId} style={styles.cardSlot}>
            <OnboardingClubCard
              club={club}
              selected={selectedIds.has(club.competitorId)}
              language={language}
              onPress={() => onToggle(club)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { t, language } = useTranslation();
  const copy = t.onboardingFlow;
  const isRTL = language === 'ar';

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState<OnboardingClubPick[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const finishingRef = useRef(false);
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const searching = debounced.length >= 2;

  const selectedIds = useMemo(
    () => new Set(selected.map((row) => row.competitorId)),
    [selected],
  );

  const count = selected.length;
  const progressText = progressLabel(count, copy);
  const hintText = hintLabel(count, copy);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const clubsQuery = useQuery({
    queryKey: ['onboarding-clubs', language],
    enabled: isLoaded && isSignedIn === true,
    queryFn: () => OnboardingApi.getClubs(getToken, language),
    staleTime: 5 * 60 * 1000,
  });

  const searchQuery = useQuery({
    queryKey: ['onboarding-search', debounced, language],
    enabled: searching,
    queryFn: () => ApiFootballService.searchFootball365(debounced),
    placeholderData: (prev) => prev,
  });

  const searchHits: SearchCompetitor365[] = useMemo(() => {
    const data = searchQuery.data;
    if (!data) return [];
    const merged = [...(data.clubs ?? []), ...(data.nationalTeams ?? [])];
    const seen = new Set<number>();
    return merged.filter((row) => {
      if (!row.competitorId || seen.has(row.competitorId)) return false;
      seen.add(row.competitorId);
      return true;
    });
  }, [searchQuery.data]);

  const goMatches = useCallback(() => {
    releaseLoginInterstitialAfterOnboarding();
    router.replace('/(tabs)/matches');
  }, [router]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace('/auth/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const user = await AuthService.syncUserWithBackend(token);
        if (cancelled) return;
        if (user?.teamOnboardingCompleted === true) {
          goMatches();
        }
      } catch (err) {
        logger.warn('[onboarding] status check failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, goMatches, router]);

  const toggle = useCallback(
    (club: OnboardingClubPick) => {
      setSelected((prev) => {
        const { next, rejected } = toggleOnboardingPick(prev, club);
        if (rejected) {
          toastManager.showInfo(copy.maxTeamsTitle, copy.maxTeams);
        }
        return next;
      });
    },
    [copy.maxTeams, copy.maxTeamsTitle],
  );

  const finish = useCallback(
    async (skipped: boolean) => {
      if (finishingRef.current || submitting) return;
      if (!skipped && !canSubmitOnboardingPicks(selected.length)) return;
      finishingRef.current = true;
      setSubmitting(true);
      Keyboard.dismiss();
      try {
        await OnboardingApi.complete(
          getToken,
          skipped ? { skipped: true } : { teams: selected },
          language,
        );
        if (!skipped && selected.length > 0) {
          await TeamFavoritesStorage.setTeams(
            selected.map((club) => ({
              apiTeamId: club.competitorId,
              teamName: club.name,
              teamLogo: club.logo,
              country: club.country,
            })),
          );
        }
        AuthService.clearMemoryCache();
        goMatches();
      } catch (err) {
        logger.warn('[onboarding] complete failed', err);
        toastManager.showError(copy.saveErrorTitle, copy.saveError);
        finishingRef.current = false;
        setSubmitting(false);
      }
    },
    [getToken, goMatches, language, selected, submitting, copy.saveError, copy.saveErrorTitle],
  );

  const nextEnabled = canSubmitOnboardingPicks(selected.length) && !submitting;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <Image source={APP_ICON} style={styles.appIcon} contentFit="cover" />
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.textRtl]}>{copy.worldTitle}</Text>
          <Text style={[styles.subtitle, isRTL && styles.textRtl]}>
            {copy.worldSubtitleBefore}
            {copy.worldSubtitleHighlight}
            {copy.worldSubtitleAfter}
          </Text>
        </View>

        <View style={styles.progressBlock}>
          <Text style={[styles.progressLabel, isRTL && styles.textRtl]}>{progressText}</Text>
          <View style={styles.progressTrack}>
            {[0, 1, 2].map((index) => {
              // Figma fills from the right: rightmost = first pick.
              const filledFromRight = MAX_ONBOARDING_TEAMS - 1 - index;
              const filled = count > filledFromRight;
              return (
                <View
                  key={index}
                  style={[styles.progressSeg, filled ? styles.progressSegOn : styles.progressSegOff]}
                />
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.searchWrap,
            focused && styles.searchWrapFocused,
            isRTL ? styles.searchWrapRtl : null,
          ]}
        >
          {!isRTL ? <Search size={20} color={focused ? PRIMARY : SUBTLE} /> : null}
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={copy.searchPlaceholder}
            placeholderTextColor={SUBTLE}
            style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {isRTL ? <Search size={20} color={focused ? PRIMARY : SUBTLE} /> : null}
        </View>

        {searching ? (
          <ScrollView
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.searchList}
          >
            {searchQuery.isFetching && searchHits.length === 0 ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 24 }} />
            ) : searchHits.length === 0 ? (
              <Text style={styles.emptySearch}>{copy.searchEmpty}</Text>
            ) : (
              searchHits.map((item) => {
                const picked = selectedIds.has(item.competitorId);
                const label = getTeamDisplayName(item.name, language, item.competitorId);
                return (
                  <View key={item.competitorId} style={styles.searchRow}>
                    <TeamBadge
                      name={item.name}
                      logo={item.logo ?? undefined}
                      size={40}
                      color="transparent"
                    />
                    <View style={styles.searchMeta}>
                      <Text style={styles.searchName} numberOfLines={1}>
                        {label}
                      </Text>
                      {item.country ? (
                        <Text style={styles.searchSub} numberOfLines={1}>
                          {item.country}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() =>
                        toggle({
                          competitorId: item.competitorId,
                          name: item.name,
                          logo: item.logo,
                          country: item.country,
                          isLocal: false,
                        })
                      }
                      style={[styles.followBtn, picked && styles.followBtnOn]}
                    >
                      <Text style={styles.followBtnText}>
                        {picked ? copy.following : copy.follow}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.grids}
          >
            {clubsQuery.isLoading ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 32 }} />
            ) : (
              <>
                <ClubRow
                  title={copy.famousTeams}
                  showViewAll
                  viewAllLabel={copy.viewAll}
                  clubs={clubsQuery.data?.global ?? []}
                  selectedIds={selectedIds}
                  language={language}
                  isRTL={isRTL}
                  onToggle={toggle}
                />
                <ClubRow
                  title={copy.localTeams}
                  clubs={clubsQuery.data?.local ?? []}
                  selectedIds={selectedIds}
                  language={language}
                  isRTL={isRTL}
                  onToggle={toggle}
                />
              </>
            )}
          </ScrollView>
        )}

        {/* Figma: hint sits on page bg above the white bottom nav. */}
        <View style={[styles.hintBanner, isRTL && styles.hintBannerRtl]}>
          <Text style={[styles.hintText, isRTL && styles.textRtl]}>{hintText}</Text>
          <View style={styles.hintDot} />
        </View>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <Pressable
            disabled={!nextEnabled}
            onPress={() => finish(false)}
            style={[styles.nextBtn, nextEnabled ? styles.nextBtnOn : styles.nextBtnOff]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.nextText, !nextEnabled && styles.nextTextOff]}>
                {copy.next}
              </Text>
            )}
          </Pressable>

          <Pressable disabled={submitting} onPress={() => finish(true)} hitSlop={8}>
            <Text style={styles.skip}>{copy.skip}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 20,
  },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    marginBottom: 8,
  },
  topBarSpacer: { flex: 1 },
  appIcon: {
    width: 39,
    height: 39,
    borderRadius: 11,
    overflow: 'hidden',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: INK,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 39,
  },
  subtitle: {
    marginTop: 2,
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  progressBlock: {
    marginBottom: 16,
    gap: 2,
    alignItems: 'stretch',
  },
  progressLabel: {
    color: DARK,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
  },
  progressSeg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  progressSegOn: {
    backgroundColor: PRIMARY,
  },
  progressSegOff: {
    backgroundColor: PROGRESS_IDLE,
  },
  searchWrap: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: SEARCH_BORDER,
    paddingHorizontal: 24,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  searchWrapRtl: {
    justifyContent: 'flex-end',
  },
  searchWrapFocused: {
    borderColor: PRIMARY,
  },
  searchInput: {
    flex: 1,
    color: INK,
    fontSize: 13,
    fontWeight: '400',
    paddingVertical: 0,
  },
  section: {
    marginBottom: 16,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 35,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionAccent: {
    width: 4,
    height: 17,
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },
  sectionTitle: {
    color: INK,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 26,
  },
  viewAll: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 122,
  },
  cardSlot: {
    width: 88,
    maxWidth: 88,
    flexGrow: 0,
    flexShrink: 1,
    height: 122,
  },
  grids: {
    paddingBottom: 12,
  },
  searchList: {
    paddingBottom: 12,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E0F5',
  },
  searchMeta: {
    flex: 1,
    minWidth: 0,
  },
  searchName: {
    color: INK,
    fontSize: 15,
    fontWeight: '600',
  },
  searchSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  followBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  followBtnOn: {
    backgroundColor: DARK,
  },
  followBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptySearch: {
    color: MUTED,
    textAlign: 'center',
    marginTop: 32,
    fontSize: 15,
  },
  hintBanner: {
    height: 42,
    borderRadius: 12,
    backgroundColor: HINT_BG,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  hintBannerRtl: {
    flexDirection: 'row-reverse',
  },
  hintText: {
    flex: 1,
    color: DARK,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  hintDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
  footer: {
    gap: 11,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: FOOTER_BORDER,
    backgroundColor: '#FFFFFF',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  nextBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnOn: {
    backgroundColor: PRIMARY,
  },
  nextBtnOff: {
    backgroundColor: BTN_DISABLED_BG,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  nextTextOff: {
    color: BTN_DISABLED_TEXT,
  },
  skip: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    minHeight: 30,
    textAlignVertical: 'center',
  },
});
