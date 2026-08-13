/**
 * Football search (text-only) — clubs, national teams, and players via 365Scores.
 * Recent query history when idle; grouped results after a 2+ character query.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StatusBar,
    Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Clock, ChevronRight } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { useTranslation } from '../src/i18n';
import { getTeamDisplayName } from '../utils/i18nHelpers';
import { useHaptic } from '../hooks/useHaptic';
import ApiFootballService, {
    type FootballSearchResults,
    type SearchCompetitor365,
    type SearchAthlete365,
} from '../services/apiFootball';
import { RecentSearchStorage } from '../src/storage/recentSearch.storage';
import TeamBadge from '../components/common/TeamBadge';
import CachedAthletePhoto from '../components/common/CachedAthletePhoto';
import { pushPlayerCareer } from '../utils/openPlayerProfile';

const DEBOUNCE_MS = 280;

function useDebouncedValue(value: string, delay: number): string {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

function SectionHeader({ title, count }: { title: string; count: number }) {
    if (count === 0) return null;
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionCount}>{count}</Text>
        </View>
    );
}

function CompetitorRow({
    item,
    language,
    onPress,
}: {
    item: SearchCompetitor365;
    language: 'ar' | 'en';
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
            <TeamBadge name={item.name} logo={item.logo ?? undefined} size={40} color="transparent" />
            <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                    {getTeamDisplayName(item.name, language, item.competitorId)}
                </Text>
                {item.country ? (
                    <Text style={styles.rowSub} numberOfLines={1}>
                        {item.country}
                    </Text>
                ) : null}
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>
    );
}

function PlayerRow({ item, onPress }: { item: SearchAthlete365; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
            <CachedAthletePhoto uri={item.imageUrl} size={40} recyclingKey={item.athleteId} />
            <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.name}
                </Text>
                {item.clubName ? (
                    <Text style={styles.rowSub} numberOfLines={1}>
                        {item.clubName}
                    </Text>
                ) : null}
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>
    );
}

export default function FootballSearchScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t, language } = useTranslation();
    const { trigger } = useHaptic();
    const inputRef = useRef<TextInput>(null);

    const [query, setQuery] = useState('');
    const [recent, setRecent] = useState<string[]>([]);
    const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS);
    const canSearch = debounced.length >= 2;

    useEffect(() => {
        RecentSearchStorage.getRecent().then(setRecent);
        const id = setTimeout(() => inputRef.current?.focus(), 250);
        return () => clearTimeout(id);
    }, []);

    const searchQ = useQuery<FootballSearchResults, Error>({
        queryKey: ['football-search-365', debounced, language],
        queryFn: () => ApiFootballService.searchFootball365(debounced),
        enabled: canSearch,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
    });

    const results = searchQ.data;
    const total =
        (results?.clubs.length ?? 0) +
        (results?.nationalTeams.length ?? 0) +
        (results?.players.length ?? 0);

    useEffect(() => {
        if (!results) return;
        const urls = [
            ...results.clubs.slice(0, 6).map((c) => c.logo),
            ...results.nationalTeams.slice(0, 3).map((c) => c.logo),
            ...results.players.slice(0, 6).map((p) => p.imageUrl),
        ].filter((u): u is string => !!u);
        urls.forEach((uri) => {
            void Image.prefetch(uri);
        });
    }, [results]);

    const remember = useCallback(async (q: string) => {
        const next = await RecentSearchStorage.addRecent(q);
        setRecent(next);
    }, []);

    const handleBack = () => {
        trigger('light');
        Keyboard.dismiss();
        router.back();
    };

    const openClub = (item: SearchCompetitor365) => {
        trigger('light');
        void remember(query.trim() || item.name);
        router.push({
            pathname: '/team-profile' as any,
            params: {
                id: String(item.competitorId),
                name: item.name,
                logo: item.logo ?? '',
            },
        } as any);
    };

    const openPlayer = (item: SearchAthlete365) => {
        trigger('light');
        void remember(query.trim() || item.name);
        pushPlayerCareer(router, {
            athleteId: item.athleteId,
            name: item.name,
            photo: item.imageUrl,
            teamName: item.clubName,
            teamId: item.clubId,
        });
    };

    const applyRecent = (q: string) => {
        trigger('light');
        setQuery(q);
    };

    const removeRecent = async (q: string) => {
        const next = await RecentSearchStorage.removeRecent(q);
        setRecent(next);
    };

    const clearRecent = async () => {
        await RecentSearchStorage.clearAll();
        setRecent([]);
    };

    const showIdle = query.trim().length === 0;
    const showMinHint = query.trim().length === 1;
    const showSearching = canSearch && (searchQ.isFetching || searchQ.isLoading);
    const showEmpty =
        canSearch && !searchQ.isFetching && !searchQ.isLoading && !searchQ.isError && total === 0;
    const showError = canSearch && searchQ.isError && !searchQ.isFetching;

    const idleHint = useMemo(
        () => (recent.length === 0 ? t.searchScreen.startSub : null),
        [recent.length, t],
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" />

            <View style={styles.searchBar}>
                <TouchableOpacity
                    onPress={handleBack}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.backBtn}
                >
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.inputWrap}>
                    <Search size={18} color={Colors.purpleSoft} />
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        value={query}
                        onChangeText={setQuery}
                        placeholder={t.searchScreen.footballPlaceholder}
                        placeholderTextColor={Colors.textMuted}
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                        onSubmitEditing={() => {
                            if (canSearch) void remember(debounced);
                        }}
                    />
                    {query.length > 0 ? (
                        <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <X size={16} color={Colors.textMuted} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            <ScrollView
                style={styles.body}
                contentContainerStyle={[styles.bodyInner, { paddingBottom: insets.bottom + Spacing['4xl'] }]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >
                {showIdle ? (
                    <>
                        {recent.length > 0 ? (
                            <View style={styles.recentHeader}>
                                <Text style={styles.sectionTitle}>{t.searchScreen.recent}</Text>
                                <TouchableOpacity onPress={clearRecent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Text style={styles.clearAll}>{t.searchScreen.clearAll}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.emptyIdle}>
                                <Search size={28} color={Colors.textMuted} />
                                <Text style={styles.emptyTitle}>{t.searchScreen.startTitle}</Text>
                                {idleHint ? <Text style={styles.emptySub}>{idleHint}</Text> : null}
                            </View>
                        )}
                        {recent.map((q) => (
                            <View key={q} style={styles.recentRow}>
                                <TouchableOpacity style={styles.recentHit} onPress={() => applyRecent(q)}>
                                    <Clock size={16} color={Colors.textMuted} />
                                    <Text style={styles.recentText} numberOfLines={1}>
                                        {q}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => void removeRecent(q)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <X size={14} color={Colors.textMuted} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </>
                ) : null}

                {showMinHint ? (
                    <View style={styles.emptyIdle}>
                        <Text style={styles.emptySub}>{t.searchScreen.minCharsSub}</Text>
                    </View>
                ) : null}

                {showSearching ? (
                    <View style={styles.loading}>
                        <ActivityIndicator color={Colors.purpleSoft} />
                        <Text style={styles.emptySub}>{t.searchScreen.searching}</Text>
                    </View>
                ) : null}

                {showError ? (
                    <View style={styles.emptyIdle}>
                        <Text style={styles.emptyTitle}>{t.searchScreen.errorTitle}</Text>
                        <Text style={styles.emptySub}>{t.searchScreen.errorSub}</Text>
                    </View>
                ) : null}

                {showEmpty ? (
                    <View style={styles.emptyIdle}>
                        <Text style={styles.emptyTitle}>{t.searchScreen.noResults}</Text>
                        <Text style={styles.emptySub}>{t.searchScreen.noResultsSub}</Text>
                    </View>
                ) : null}

                {canSearch && !showSearching && results ? (
                    <>
                        <SectionHeader title={t.searchScreen.sectionClubs} count={results.clubs.length} />
                        {results.clubs.map((c) => (
                            <CompetitorRow
                                key={`c-${c.competitorId}`}
                                item={c}
                                language={language}
                                onPress={() => openClub(c)}
                            />
                        ))}

                        <SectionHeader
                            title={t.searchScreen.sectionNationalTeams}
                            count={results.nationalTeams.length}
                        />
                        {results.nationalTeams.map((c) => (
                            <CompetitorRow
                                key={`n-${c.competitorId}`}
                                item={c}
                                language={language}
                                onPress={() => openClub(c)}
                            />
                        ))}

                        <SectionHeader title={t.searchScreen.sectionPlayers} count={results.players.length} />
                        {results.players.map((p) => (
                            <PlayerRow key={`p-${p.athleteId}`} item={p} onPress={() => openPlayer(p)} />
                        ))}
                    </>
                ) : null}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgBase,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.base,
        paddingVertical: Spacing.sm,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: Radius.full,
        backgroundColor: Colors.white08,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        height: 44,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.chip,
        backgroundColor: Colors.surfaceGlass,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
    },
    input: {
        flex: 1,
        color: Colors.textPrimary,
        fontSize: FontSize.xl,
        paddingVertical: 0,
    },
    body: {
        flex: 1,
    },
    bodyInner: {
        paddingHorizontal: Spacing.base,
        paddingTop: Spacing.sm,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    sectionTitle: {
        color: Colors.textPrimary,
        fontSize: FontSize['2xl'],
        fontWeight: FontWeight.bold,
    },
    sectionCount: {
        color: Colors.textMuted,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderSubtle,
    },
    rowInfo: {
        flex: 1,
        gap: 2,
    },
    rowTitle: {
        color: Colors.textPrimary,
        fontSize: FontSize.xl,
        fontWeight: FontWeight.semibold,
    },
    rowSub: {
        color: Colors.textSecondary,
        fontSize: FontSize.md,
    },
    playerPhoto: {
        width: 40,
        height: 40,
        borderRadius: Radius.full,
        backgroundColor: Colors.white08,
    },
    playerPhotoFallback: {
        width: 40,
        height: 40,
        borderRadius: Radius.full,
        backgroundColor: Colors.purpleMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
        marginTop: Spacing.sm,
    },
    clearAll: {
        color: Colors.purpleSoft,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
    },
    recentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderSubtle,
    },
    recentHit: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    recentText: {
        color: Colors.textPrimary,
        fontSize: FontSize.xl,
        flexShrink: 1,
    },
    emptyIdle: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing['5xl'],
        gap: Spacing.sm,
    },
    emptyTitle: {
        color: Colors.textPrimary,
        fontSize: FontSize['3xl'],
        fontWeight: FontWeight.bold,
        textAlign: 'center',
    },
    emptySub: {
        color: Colors.textMuted,
        fontSize: FontSize.lg,
        textAlign: 'center',
    },
    loading: {
        alignItems: 'center',
        paddingVertical: Spacing['4xl'],
        gap: Spacing.md,
    },
});
