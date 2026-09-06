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
import { LinearGradient } from 'expo-linear-gradient';
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

const LOGO = require('../assets/images/90Plus.png');
const SEARCH_DEBOUNCE_MS = 150;

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function ClubRow({
  title,
  clubs,
  selectedIds,
  language,
  onToggle,
}: {
  title: string;
  clubs: OnboardingClubPick[];
  selectedIds: Set<number>;
  language: 'ar' | 'en';
  onToggle: (club: OnboardingClubPick) => void;
}) {
  if (clubs.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionAccent} />
      </View>
      <View style={styles.row}>
        {clubs.map((club) => (
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
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 8 }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
          <Text style={styles.title}>{copy.worldTitle}</Text>
          <Text style={styles.subtitle}>
            {copy.worldSubtitleBefore}
            <Text style={styles.subtitleAccent}>{copy.worldSubtitleHighlight}</Text>
            {copy.worldSubtitleAfter}
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {selected.length} / {MAX_ONBOARDING_TEAMS}
            </Text>
          </View>
        </View>

        <View style={[styles.searchWrap, focused && styles.searchWrapFocused]}>
          <Search size={18} color={focused ? '#fff' : '#616161'} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={copy.searchPlaceholder}
            placeholderTextColor="#616161"
            style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>

        {searching ? (
          <ScrollView
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.searchList}
          >
            {searchQuery.isFetching && searchHits.length === 0 ? (
              <ActivityIndicator color="#8B5CF6" style={{ marginTop: 24 }} />
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
              <ActivityIndicator color="#8B5CF6" style={{ marginTop: 32 }} />
            ) : (
              <>
                <ClubRow
                  title={copy.famousTeams}
                  clubs={clubsQuery.data?.global ?? []}
                  selectedIds={selectedIds}
                  language={language}
                  onToggle={toggle}
                />
                <ClubRow
                  title={copy.localTeams}
                  clubs={clubsQuery.data?.local ?? []}
                  selectedIds={selectedIds}
                  language={language}
                  onToggle={toggle}
                />
              </>
            )}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <Pressable
            disabled={!nextEnabled}
            onPress={() => finish(false)}
            style={styles.nextPress}
          >
            <LinearGradient
              colors={nextEnabled ? ['#8B5CF6', '#462f7a'] : ['#2A2433', '#1a1622']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.nextBtn}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.nextText, !nextEnabled && styles.nextTextOff]}>
                  {copy.next}
                </Text>
              )}
            </LinearGradient>
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
    backgroundColor: '#030303',
    paddingHorizontal: 22,
  },
  flex: { flex: 1 },
  header: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  logo: {
    width: 46,
    height: 45,
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: '#AEAEAE',
    fontSize: 16,
    textAlign: 'center',
  },
  subtitleAccent: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  pill: {
    marginTop: 16,
    minWidth: 69,
    height: 23,
    paddingHorizontal: 10,
    borderRadius: 48,
    backgroundColor: '#160c2c',
    borderWidth: 0.5,
    borderColor: '#38216a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchWrap: {
    height: 57,
    borderRadius: 16,
    backgroundColor: '#0a080e',
    borderWidth: 0.5,
    borderColor: '#211c27',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  searchWrapFocused: {
    borderColor: '#8B5CF6',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  sectionAccent: {
    width: 2,
    height: 16,
    backgroundColor: '#8B5CF6',
    borderRadius: 1,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    height: 95,
  },
  cardSlot: {
    flex: 1,
    minWidth: 0,
    height: 95,
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
  },
  searchMeta: {
    flex: 1,
    minWidth: 0,
  },
  searchName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  searchSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  followBtn: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  followBtnOn: {
    backgroundColor: '#3b2a66',
  },
  followBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptySearch: {
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 15,
  },
  footer: {
    gap: 12,
    paddingTop: 8,
  },
  nextPress: {
    width: '100%',
  },
  nextBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  nextTextOff: {
    color: 'rgba(255,255,255,0.35)',
  },
  skip: {
    color: '#851818',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
