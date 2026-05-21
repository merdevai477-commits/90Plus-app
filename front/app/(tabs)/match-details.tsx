import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiFootballService, { Lineup, TeamStatistics, TeamFixture, Fixture, FixtureEvent, Venue } from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n';
import { getTeamDisplayName } from '../../utils/i18nHelpers';
import { MatchHeader } from '../../components/match-details/MatchHeader';
import { ModernTabs } from '../../components/match-details/ModernTabs';
import { APP_BG } from '../../constants/ui';
import { FootballField } from '../../components/match-details/FootballField';
import { matchArchiveService } from '../../services/matchArchiveService';
import TeamBadge from '../../components/common/TeamBadge';
import LeagueIcon from '../../components/common/LeagueIcon';
import { useScreenFont } from '../../utils/fontSetup';
import { Image as ExpoImage } from 'expo-image';
import {
  EventsSkeleton,
  LineupsSkeleton,
  StatsSkeleton,
  FormSkeleton,
  StandingsSkeleton,
  useShimmer,
} from '../../components/match-details/MatchDetailsSkeleton';

const { width, height } = Dimensions.get('window');

interface MatchDetailsParams {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeScore?: string;
  awayScore?: string;
  league: string;
  leagueLogo?: string;
  date: string;
  time: string;
  status: string;
}

const MatchDetailsScreen = () => {
  useScreenFont();
  const router = useRouter();
  const { t, language } = useTranslation();
  const params = useLocalSearchParams() as unknown as MatchDetailsParams;
  const shimmerX = useShimmer();

  // Safety check for translations
  if (!t || !t.matchDetails) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
    );
  }

  const [activeTab, setActiveTab] = useState<'lineups' | 'stats' | 'form' | 'events' | 'standings' | 'stadium'>('events');
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(false);

  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [statistics, setStatistics] = useState<TeamStatistics[]>([]);
  const [homeLastFixtures, setHomeLastFixtures] = useState<TeamFixture[]>([]);
  const [awayLastFixtures, setAwayLastFixtures] = useState<TeamFixture[]>([]);
  const [events, setEvents] = useState<FixtureEvent[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [fixture, setFixture] = useState<Fixture | null>(null);

  const [loading, setLoading] = useState(true);
  const [lineupsLoading, setLineupsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [lineupsError, setLineupsError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [standingsError, setStandingsError] = useState<string | null>(null);

  // Track which tabs have already loaded their data (lazy loading)
  const loadedTabsRef = useRef<Set<string>>(new Set());

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const fixtureId = parseInt(params.fixtureId || '0');

  // Determine if the match is live based on fixture status or params
  const isLive = useCallback(() => {
    if (fixture) {
      const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'];
      return liveStatuses.includes(fixture.fixture.status.short);
    }
    return params.status === 'live';
  }, [fixture, params.status]);

  // Live polling interval ref
  const livePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Reset state immediately when fixtureId changes to prevent stale data
    setEvents([]);
    setLineups([]);
    setStatistics([]);
    setFixture(null);
    setHomeLastFixtures([]);
    setAwayLastFixtures([]);
    setStandings([]);
    setLoading(true);
    setError(null);
    setLineupsLoading(false);
    setStatsLoading(false);
    setFormLoading(false);
    setStandingsLoading(false);
    loadedTabsRef.current = new Set(); // reset lazy-load tracking

    loadMatchDetails();

    // Reset animations
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fixtureId]);

  // Live match polling: refresh fixture data + events every 30 seconds
  useEffect(() => {
    // Clear any existing interval
    if (livePollingRef.current) {
      clearInterval(livePollingRef.current);
      livePollingRef.current = null;
    }

    if (!isLive() || !fixtureId) return;

    const pollLiveData = async () => {
      try {
        const [eventsData, fixtureData] = await Promise.allSettled([
          ApiFootballService.getFixtureEvents(fixtureId),
          ApiFootballService.getFixtureById(fixtureId),
        ]);

        if (eventsData.status === 'fulfilled') setEvents(eventsData.value);
        if (fixtureData.status === 'fulfilled' && fixtureData.value) {
          setFixture(fixtureData.value);

          // If match just finished, stop polling
          const finishedStatuses = ['FT', 'AET', 'PEN'];
          if (finishedStatuses.includes(fixtureData.value.fixture.status.short)) {
            if (livePollingRef.current) {
              clearInterval(livePollingRef.current);
              livePollingRef.current = null;
            }
            // Reset stats tab so it reloads with final data
            loadedTabsRef.current.delete('stats');
          }
        }
      } catch {
        // Silent fail — don't disrupt the UI for a background poll
      }
    };

    // Poll every 8 seconds for live matches (matches the home list cadence)
    livePollingRef.current = setInterval(pollLiveData, 8_000);

    return () => {
      if (livePollingRef.current) {
        clearInterval(livePollingRef.current);
        livePollingRef.current = null;
      }
    };
  }, [fixtureId, fixture?.fixture?.status?.short, params.status]);

  const loadMatchDetails = async () => {
    if (!fixtureId) {
      setError(t.matchDetails.invalidMatchId);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // ── FAST PATH: Only load events + fixture details on open ──────────────
      // Lineups, stats, form, standings load lazily when their tab is tapped.
      const [eventsData, fixtureData] = await Promise.allSettled([
        ApiFootballService.getFixtureEvents(fixtureId),
        ApiFootballService.getFixtureById(fixtureId),
      ]);

      if (eventsData.status === 'fulfilled' && eventsData.value) {
        setEvents(eventsData.value);
      }
      if (fixtureData.status === 'fulfilled' && fixtureData.value) {
        const details = fixtureData.value;
        setFixture(details);

        // Archive finished matches in background (non-blocking)
        const finishedStatuses = ['FT', 'AET', 'PEN'];
        if (finishedStatuses.includes(details.fixture.status.short)) {
          Promise.allSettled([
            ApiFootballService.getFixtureLineups(fixtureId),
            ApiFootballService.getFixtureStatistics(fixtureId),
            eventsData.status === 'fulfilled'
              ? Promise.resolve(eventsData.value)
              : ApiFootballService.getFixtureEvents(fixtureId),
          ]).then(([lineupsRes, statsRes, eventsRes]) => {
            try {
              matchArchiveService.archiveMatchFromData(
                details,
                lineupsRes.status === 'fulfilled' ? lineupsRes.value : [],
                statsRes.status === 'fulfilled' ? statsRes.value : [],
                eventsRes.status === 'fulfilled' ? eventsRes.value : [],
              );
            } catch { /* non-fatal */ }
          }).catch(() => {});
        }
      } else if (fixtureData.status === 'rejected') {
        // If fixture fetch failed entirely, show error but don't block the screen
        // The params still provide basic display info (team names, scores)
        setError(fixtureData.reason?.message || t.matchDetails.loadDetailsFailed);
      }

      setLoading(false);
    } catch (err: any) {
      setError(err?.message || t.matchDetails.loadDetailsFailed);
      setLoading(false);
    }
  };

  // ── Lazy loaders — called when a tab is first activated ───────────────────
  const loadLineupsIfNeeded = useCallback(async () => {
    if (loadedTabsRef.current.has('lineups')) return;
    loadedTabsRef.current.add('lineups');
    setLineupsLoading(true);
    try {
      const data = await ApiFootballService.getFixtureLineups(fixtureId);
      setLineups(data);
    } catch (err: any) {
      setLineupsError(err?.message || t.matchDetails.loadLineupsFailed);
    } finally {
      setLineupsLoading(false);
    }
  }, [fixtureId]);

  const loadStatsIfNeeded = useCallback(async () => {
    if (loadedTabsRef.current.has('stats')) return;
    loadedTabsRef.current.add('stats');
    setStatsLoading(true);
    try {
      const data = await ApiFootballService.getFixtureStatistics(fixtureId);
      setStatistics(data);
    } catch (err: any) {
      setStatsError(err?.message || t.matchDetails.loadStatsFailed);
    } finally {
      setStatsLoading(false);
    }
  }, [fixtureId]);

  const loadFormIfNeeded = useCallback(async () => {
    if (loadedTabsRef.current.has('form') || !fixture) return;
    loadedTabsRef.current.add('form');
    setFormLoading(true);
    try {
      const homeId = fixture.teams.home.id;
      const awayId = fixture.teams.away.id;
      const [homeRes, awayRes] = await Promise.allSettled([
        ApiFootballService.getTeamLastFixtures(homeId, 5),
        ApiFootballService.getTeamLastFixtures(awayId, 5),
      ]);
      if (homeRes.status === 'fulfilled') setHomeLastFixtures(homeRes.value);
      if (awayRes.status === 'fulfilled') setAwayLastFixtures(awayRes.value);
    } catch { /* silent */ }
    finally { setFormLoading(false); }
  }, [fixtureId, fixture]);

  const loadStandingsIfNeeded = useCallback(async () => {
    if (loadedTabsRef.current.has('standings') || !fixture) return;
    loadedTabsRef.current.add('standings');
    setStandingsLoading(true);
    try {
      const data = await ApiFootballService.getStandings(
        fixture.league.id,
        fixture.league.season,
      );
      setStandings(data);
    } catch (err: any) {
      setStandingsError(err?.message || t.matchDetails.loadStandingsFailed);
    } finally {
      setStandingsLoading(false);
    }
  }, [fixtureId, fixture]);

  const loadVenueIfNeeded = useCallback(async () => {
    if (loadedTabsRef.current.has('stadium') || !fixture?.fixture.venue?.id) return;
    loadedTabsRef.current.add('stadium');
    setVenueLoading(true);
    try {
      const data = await ApiFootballService.getVenueInfo(fixture.fixture.venue.id);
      setVenue(data);
    } catch { /* silent */ }
    finally { setVenueLoading(false); }
  }, [fixtureId, fixture]);

  // ── Tab change handler — triggers lazy load ───────────────────────────────
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as any);
    switch (tab) {
      case 'lineups':   loadLineupsIfNeeded(); break;
      case 'stats':     loadStatsIfNeeded(); break;
      case 'form':      loadFormIfNeeded(); break;
      case 'standings': loadStandingsIfNeeded(); break;
      case 'stadium':   loadVenueIfNeeded(); break;
    }
  }, [loadLineupsIfNeeded, loadStatsIfNeeded, loadFormIfNeeded, loadStandingsIfNeeded, loadVenueIfNeeded]);

  const parseFormation = (formation: string | null): number[] => {
    if (!formation) return [];
    return formation.split('-').map(Number).filter(n => !isNaN(n));
  };

  const parseGrid = (grid: string | null): { x: number; y: number } | null => {
    if (!grid) return null;
    const [x, y] = grid.split(':').map(Number);
    return { x: x || 0, y: y || 0 };
  };

  const getPositionName = (pos: string | null): string => {
    const positions: { [key: string]: string } = {
      'G': t.matchDetails?.goalkeeper || 'GK',
      'D': t.matchDetails?.defender || 'DEF',
      'M': t.matchDetails?.midfielder || 'MID',
      'F': t.matchDetails?.forward || 'FWD',
    };
    return positions[pos || ''] || String(pos || '') || t.common?.unknown || 'Unknown';
  };

  // Player Card Component with proper player photo
  const PlayerCard = ({ player, number, position }: { player: any; number: number; position: string | null }) => {
    const playerPhoto = player.photo || `https://media.api-sports.io/football/players/${player.id}.png`;
    return (
      <View style={styles.playerCard}>
        <View style={styles.playerNumber}>
          <Text style={styles.playerNumberText}>{number}</Text>
        </View>
        <ExpoImage
          source={{ uri: playerPhoto }}
          style={styles.playerPhoto}
          contentFit="cover"
          cachePolicy="memory-disk"
          placeholder={require('../../assets/images/football.png')}
        />
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.playerName} numberOfLines={2}>{player.name}</Text>
          <Text style={styles.playerPosition}>{getPositionName(position)}</Text>
        </View>
      </View>
    );
  };

  // Helper function to get event icon
  const getEventIcon = (type: string, detail: string) => {
    if (type === 'Goal') return 'football';
    if (type === 'Card') {
      if (detail.includes('Yellow')) return 'card';
      if (detail.includes('Red')) return 'card';
    }
    if (type === 'subst') return 'swap-horizontal';
    return 'information-circle';
  };

  // Helper function to get event color
  const getEventColor = (type: string, detail: string) => {
    if (type === 'Goal') return '#22c55e';
    if (type === 'Card') {
      if (detail.includes('Yellow')) return '#f59e0b';
      if (detail.includes('Red')) return '#ef4444';
    }
    if (type === 'subst') return '#3b82f6';
    return '#888';
  };

  // Helper function to get event label
  const getEventLabel = (type: string, detail: string) => {
    if (type === 'Goal') {
      if (detail.includes('Penalty')) return t.matchDetails.penaltyGoal;
      if (detail.includes('Own')) return t.matchDetails.ownGoal;
      return t.matchDetails.goal;
    }
    if (type === 'Card') {
      if (detail.includes('Yellow')) return t.matchDetails.yellowCard;
      if (detail.includes('Red')) return t.matchDetails.redCard;
    }
    if (type === 'subst') return t.matchDetails.substitution;
    return detail;
  };

  // Render Events Tab
  const renderEvents = () => {
    if (events.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="football-outline" size={64} color="#333" />
          <Text style={styles.emptyStateText}>{t.matchDetails.noEvents}</Text>
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.eventsContainer}>
          <Text style={styles.sectionTitle}>{t.matchDetails.matchEvents}</Text>
          {events.map((event, index) => {
            const isHomeTeam = event.team.name.toLowerCase().includes(params.homeTeam.toLowerCase()) ||
              params.homeTeam.toLowerCase().includes(event.team.name.toLowerCase());

            return (
              <View key={index} style={[styles.eventCard, isHomeTeam ? styles.eventHome : styles.eventAway]}>
                <View style={styles.eventTime}>
                  <Text style={styles.eventTimeText}>{event.time.elapsed}'</Text>
                  {!!event.time.extra && (
                    <Text style={styles.eventExtraTime}>+{event.time.extra}'</Text>
                  )}
                </View>

                <View style={[styles.eventIcon, { backgroundColor: `${getEventColor(event.type, event.detail)}20` }]}>
                  <Ionicons
                    name={getEventIcon(event.type, event.detail) as any}
                    size={20}
                    color={getEventColor(event.type, event.detail)}
                  />
                </View>

                <View style={styles.eventDetails}>
                  {!!event.player.name && <Text style={styles.eventPlayer}>{String(event.player.name)}</Text>}
                  <Text style={styles.eventType}>{getEventLabel(event.type, event.detail)}</Text>
                  {!!event.assist.name && (
                    <Text style={styles.eventAssist}>{t.matchDetails?.assist || 'Assist'}: {String(event.assist.name)}</Text>
                  )}
                </View>

                <TeamBadge name={getTeamDisplayName(event.team.name, language)} logo={event.team.logo} size={30} color="transparent" />
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Render Lineups Tab
  const renderLineups = () => {
    if (lineupsLoading) {
      return <LineupsSkeleton shimmerX={shimmerX} />;
    }

    if (lineupsError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.emptyStateText}>{lineupsError}</Text>
        </View>
      );
    }

    if (lineups.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#333" />
          <Text style={styles.emptyStateText}>{t.matchDetails.lineups || 'No lineups available'}</Text>
          <Text style={styles.emptyStateSubtext}>{'Lineups are not available yet'}</Text>
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.lineupsContainer}>
          {lineups.map((lineup, index) => {
            const formation = lineup.formation || '4-4-2'; // Default fallback
            const startingXI = lineup.startXI || [];
            const substitutes = lineup.substitutes || [];

            // Map API players to FootballField players
            const fieldPlayers = startingXI.map((item: any) => ({
              id: item.player.id,
              name: item.player.name,
              number: item.player.number,
              pos: item.player.pos,
              grid: item.player.grid,
              photo: item.player.photo || `https://media.api-sports.io/football/players/${item.player.id}.png`
            }));

            return (
              <View key={index} style={styles.teamLineupContainer}>
                <View style={styles.teamHeader}>
                  <TeamBadge name={lineup.team.name} logo={lineup.team.logo} size={60} color="transparent" />
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName} numberOfLines={2}>{getTeamDisplayName(lineup.team.name, language)}</Text>
                    <Text style={styles.formationText}>
                      {t.matchDetails.formation}: {formation}
                    </Text>
                    <Text style={styles.coachText}>
                      {t.matchDetails.coach}: {lineup.coach?.name || t.common.unknown}
                    </Text>
                  </View>
                </View>

                {/* Football Field Visualization */}
                <FootballField
                  formation={formation}
                  players={fieldPlayers}
                  teamName={lineup.team.name}
                  teamColor={index === 0 ? params.homeTeam === lineup.team.name ? '#A855F7' : '#3b82f6' : params.awayTeam === lineup.team.name ? '#3b82f6' : '#A855F7'}
                  onPlayerPress={(player) => {
                    if (player.id) {
                      router.push({
                        pathname: '/player-profile' as any,
                        params: {
                          id: player.id.toString(),
                          name: player.name,
                          photo: player.photo || '',
                          teamName: lineup.team.name,
                          teamLogo: lineup.team.logo,
                        }
                      } as any);
                    }
                  }}
                />

                {/* Substitutes */}
                {substitutes.length > 0 && (
                  <View style={styles.substitutesSection}>
                    <Text style={styles.substitutesTitle}>{t.matchDetails.substitutes}</Text>
                    <View style={styles.substitutesGrid}>
                      {substitutes.map((item: any) => (
                        <TouchableOpacity
                          key={item.player.id}
                          style={styles.substituteCard}
                          onPress={() => {
                            router.push({
                              pathname: '/player-profile' as any,
                              params: {
                                id: item.player.id.toString(),
                                name: item.player.name,
                                photo: item.player.photo || `https://media.api-sports.io/football/players/${item.player.id}.png`,
                                teamName: lineup.team.name,
                                teamLogo: lineup.team.logo,
                              }
                            } as any);
                          }}
                        >
                          <ExpoImage
                            source={{ uri: item.player.photo || `https://media.api-sports.io/football/players/${item.player.id}.png` }}
                            style={{ width: 28, height: 28, borderRadius: 14 }}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                          <Text style={styles.substituteNumber}>{item.player.number || '-'}</Text>
                          <View style={styles.substituteInfo}>
                            <Text style={styles.substituteName} numberOfLines={1}>{item.player.name}</Text>
                            <Text style={styles.substitutePos}>{item.player.pos}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Render Statistics Tab
  const renderStatistics = () => {
    if (statsLoading) {
      return <StatsSkeleton shimmerX={shimmerX} />;
    }

    if (statsError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.emptyStateText}>{statsError}</Text>
        </View>
      );
    }

    if (statistics.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="stats-chart-outline" size={64} color="#333" />
          <Text style={styles.emptyStateText}>{t.matchDetails.statistics || 'No statistics'}</Text>
          <Text style={styles.emptyStateSubtext}>{'Statistics are not available yet'}</Text>
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>{t.matchDetails.statistics || 'Match Statistics'}</Text>
          {statistics[0]?.statistics.map((stat: any, index: number) => {
            const homeValue = stat.value;
            const awayValue = statistics[1]?.statistics[index]?.value || 0;

            const homeNum = typeof homeValue === 'string' ? parseInt(homeValue) || 0 : homeValue || 0;
            const awayNum = typeof awayValue === 'string' ? parseInt(awayValue) || 0 : awayValue || 0;
            const total = homeNum + awayNum || 1;
            const homePercentage = (homeNum / total) * 100;
            const awayPercentage = (awayNum / total) * 100;

            return (
              <View key={index} style={styles.statRow}>
                <Text style={styles.statValue}>{String(homeValue || '0')}</Text>
                <View style={styles.statCenter}>
                  <Text style={styles.statLabel}>{String(stat.type || '')}</Text>
                  <View style={styles.statBarsContainer}>
                    <View style={[styles.statBar, styles.statBarHome, { width: `${homePercentage}%` }]} />
                    <View style={[styles.statBar, styles.statBarAway, { width: `${awayPercentage}%` }]} />
                  </View>
                </View>
                <Text style={styles.statValue}>{String(awayValue || '0')}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };


  const renderForm = () => {
    // البحث عن team IDs من lineups
    const homeLineup = lineups.find(l =>
      l.team.name.toLowerCase().includes(params.homeTeam.toLowerCase()) ||
      params.homeTeam.toLowerCase().includes(l.team.name.toLowerCase())
    );
    const awayLineup = lineups.find(l =>
      l.team.name.toLowerCase().includes(params.awayTeam.toLowerCase()) ||
      params.awayTeam.toLowerCase().includes(l.team.name.toLowerCase())
    );

    const homeTeamId = homeLineup?.team.id || (lineups.length > 0 ? lineups[0]?.team.id : null);
    const awayTeamId = awayLineup?.team.id || (lineups.length > 1 ? lineups[1]?.team.id : null);

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Home Team Last 5 Matches */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <TeamBadge name={params.homeTeam} logo={params.homeLogo} size={50} color="transparent" />
            <Text style={styles.formTeamName}>{getTeamDisplayName(params.homeTeam, language)}</Text>
            <Text style={styles.formTitle}>{t.matchDetails.last5Matches}</Text>
          </View>
          {homeLastFixtures.length > 0 ? (
            <View style={styles.fixturesList}>
              {homeLastFixtures.map((fixture, index) => {
                const isHome = homeTeamId ? fixture.teams.home.id === homeTeamId : true;
                const opponent = isHome ? fixture.teams.away : fixture.teams.home;
                const teamScore = isHome ? fixture.goals.home : fixture.goals.away;
                const opponentScore = isHome ? fixture.goals.away : fixture.goals.home;
                const result = fixture.teams.home.winner === true ? 'win' :
                  fixture.teams.away.winner === true ? 'lose' : 'draw';

                return (
                  <View key={index} style={styles.fixtureCard}>
                    <TeamBadge name={opponent.name} logo={opponent.logo} size={40} color="transparent" />
                    <View style={styles.fixtureInfo}>
                      <Text style={styles.fixtureOpponent}>{opponent.name}</Text>
                      <Text style={styles.fixtureLeague}>{fixture.league.name}</Text>
                    </View>
                    <View style={[styles.fixtureResult, result === 'win' && styles.fixtureWin,
                    result === 'lose' && styles.fixtureLose,
                    result === 'draw' && styles.fixtureDraw]}>
                      <Text style={styles.fixtureScore}>{teamScore} - {opponentScore}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t.matchDetails.noPreviousMatches}</Text>
            </View>
          )}
        </View>

        {/* Away Team Last 5 Matches */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <TeamBadge name={params.awayTeam} logo={params.awayLogo} size={50} color="transparent" />
            <Text style={styles.formTeamName}>{getTeamDisplayName(params.awayTeam, language)}</Text>
            <Text style={styles.formTitle}>{t.matchDetails.last5Matches}</Text>
          </View>
          {awayLastFixtures.length > 0 ? (
            <View style={styles.fixturesList}>
              {awayLastFixtures.map((fixture, index) => {
                const isHome = awayTeamId ? fixture.teams.home.id === awayTeamId : false;
                const opponent = isHome ? fixture.teams.away : fixture.teams.home;
                const teamScore = isHome ? fixture.goals.home : fixture.goals.away;
                const opponentScore = isHome ? fixture.goals.away : fixture.goals.home;
                const result = fixture.teams.home.winner === true ? 'win' :
                  fixture.teams.away.winner === true ? 'lose' : 'draw';

                return (
                  <View key={index} style={styles.fixtureCard}>
                    <Image source={{ uri: opponent.logo }} style={styles.fixtureTeamLogo} />
                    <View style={styles.fixtureInfo}>
                      <Text style={styles.fixtureOpponent}>{opponent.name}</Text>
                      <Text style={styles.fixtureLeague}>{fixture.league.name}</Text>
                    </View>
                    <View style={[styles.fixtureResult, result === 'win' && styles.fixtureWin,
                    result === 'lose' && styles.fixtureLose,
                    result === 'draw' && styles.fixtureDraw]}>
                      <Text style={styles.fixtureScore}>{teamScore} - {opponentScore}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t.matchDetails.noPreviousMatches}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderStadium = () => {
    if (venueLoading) {
      return <StatsSkeleton shimmerX={shimmerX} />;
    }

    if (!venue && !fixture?.fixture.venue) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={64} color="#333" />
          <Text style={styles.emptyStateText}>{t.matchDetails.noStadiumInfo || 'No stadium information available'}</Text>
        </View>
      );
    }

    const venueData = venue || {
      id: fixture?.fixture.venue?.id,
      name: fixture?.fixture.venue?.name,
      city: fixture?.fixture.venue?.city,
      address: null,
      country: null,
      capacity: null,
      surface: null,
      image: null,
    };

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.stadiumContainer}>
          {venueData.image && (
            <Image source={{ uri: venueData.image }} style={styles.stadiumImage} />
          )}
          <View style={styles.stadiumInfo}>
            <Text style={styles.stadiumName}>{venueData.name || 'Unknown Stadium'}</Text>
            {venueData.city && (
              <View style={styles.stadiumDetail}>
                <Ionicons name="location" size={16} color="#888" />
                <Text style={styles.stadiumDetailText}>{venueData.city}</Text>
                {venueData.country && <Text style={styles.stadiumDetailText}> • {venueData.country}</Text>}
              </View>
            )}
            {venueData.address && (
              <View style={styles.stadiumDetail}>
                <Ionicons name="map" size={16} color="#888" />
                <Text style={styles.stadiumDetailText}>{venueData.address}</Text>
              </View>
            )}
            {venueData.capacity && (
              <View style={styles.stadiumDetail}>
                <Ionicons name="people" size={16} color="#888" />
                <Text style={styles.stadiumDetailText}>{t.matchDetails.capacity || 'Capacity'}: {venueData.capacity.toLocaleString()}</Text>
              </View>
            )}
            {venueData.surface && (
              <View style={styles.stadiumDetail}>
                <Ionicons name="football" size={16} color="#888" />
                <Text style={styles.stadiumDetailText}>{t.matchDetails.surface || 'Surface'}: {venueData.surface}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderStandings = () => {
    if (standingsLoading) {
      return <StandingsSkeleton shimmerX={shimmerX} />;
    }

    if (standingsError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.emptyStateText}>{standingsError}</Text>
        </View>
      );
    }

    if (standings.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={64} color="#333" />
          <Text style={styles.emptyStateText}>{t.matchDetails.standings || 'No standings available'}</Text>
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.standingsContainer}>
          <View style={styles.standingsHeader}>
            <Text style={[styles.standingsHeaderText, { width: 30 }]}>#</Text>
            <Text style={[styles.standingsHeaderText, { flex: 1, textAlign: 'left' }]}>{t.matchDetails.team}</Text>
            <Text style={[styles.standingsHeaderText, { width: 30 }]}>P</Text>
            <Text style={[styles.standingsHeaderText, { width: 30 }]}>GD</Text>
            <Text style={[styles.standingsHeaderText, { width: 30 }]}>Pts</Text>
          </View>
          {standings.map((team: any, index: number) => {
            const isHome = team.team.name.toLowerCase().includes(params.homeTeam.toLowerCase()) || params.homeTeam.toLowerCase().includes(team.team.name.toLowerCase());
            const isAway = team.team.name.toLowerCase().includes(params.awayTeam.toLowerCase()) || params.awayTeam.toLowerCase().includes(team.team.name.toLowerCase());
            const isHighlighted = isHome || isAway;

            return (
              <View key={index} style={[styles.standingsRow, isHighlighted && styles.standingsRowHighlighted]}>
                <Text style={[styles.standingsText, { width: 30 }]}>{team.rank}</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Image source={{ uri: team.team.logo }} style={{ width: 20, height: 20 }} />
                  <Text style={[styles.standingsText, { flex: 1, textAlign: 'left' }]} numberOfLines={1}>{getTeamDisplayName(team.team.name, language)}</Text>
                </View>
                <Text style={[styles.standingsText, { width: 30 }]}>{team.all.played}</Text>
                <Text style={[styles.standingsText, { width: 30 }]}>{team.goalsDiff}</Text>
                <Text style={[styles.standingsText, { width: 30, fontWeight: 'bold' }]}>{team.points}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <View style={{ paddingHorizontal: 20, paddingTop: 100 }}>
          {/* Header skeleton */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1b4b' }} />
            <View style={{ flex: 1, marginHorizontal: 16, height: 16, borderRadius: 8, backgroundColor: '#1e1b4b' }} />
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1b4b' }} />
          </View>
          {/* Score card skeleton */}
          <View style={{ height: 160, borderRadius: 24, backgroundColor: '#1e1b4b', marginBottom: 16 }} />
          {/* Tabs skeleton */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[80, 80, 90, 80, 70, 80].map((w, i) => (
              <View key={i} style={{ width: w, height: 36, borderRadius: 12, backgroundColor: '#1e1b4b' }} />
            ))}
          </View>
          {/* Events skeleton */}
          <EventsSkeleton shimmerX={shimmerX} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadMatchDetails}>
          <Text style={styles.retryButtonText}>{t.common.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tabs = [
    { key: 'events', label: t.matchDetails.events, icon: 'football' as const },
    { key: 'lineups', label: t.matchDetails.lineups, icon: 'people' as const },
    { key: 'stats', label: t.matchDetails.statistics, icon: 'stats-chart' as const },
    { key: 'form', label: t.matchDetails.form, icon: 'trending-up' as const },
    { key: 'standings', label: t.matchDetails.standings || 'Table', icon: 'list' as const },
    { key: 'stadium', label: t.matchDetails.stadium || 'Stadium', icon: 'business' as const },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0720" />

      {/* Custom Top Bar */}
      <View style={styles.customHeader}>
        <TouchableOpacity
          style={styles.backButtonRound}
          onPress={() => router.push('/(tabs)/matches' as any)}
          accessibilityRole="button"
          accessibilityLabel="العودة إلى المباريات"
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.matchDetails.title || 'Match Details'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Modern Header (Score Card) */}
        <MatchHeader
          homeTeam={getTeamDisplayName(fixture?.teams?.home?.name || params.homeTeam, language)}
          awayTeam={getTeamDisplayName(fixture?.teams?.away?.name || params.awayTeam, language)}
          homeLogo={fixture?.teams?.home?.logo || params.homeLogo}
          awayLogo={fixture?.teams?.away?.logo || params.awayLogo}
          homeScore={fixture?.goals?.home != null ? String(fixture.goals.home) : params.homeScore}
          awayScore={fixture?.goals?.away != null ? String(fixture.goals.away) : params.awayScore}
          status={fixture ? (
            ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(fixture.fixture.status.short) ? 'live'
            : ['FT', 'AET', 'PEN'].includes(fixture.fixture.status.short) ? 'finished'
            : 'upcoming'
          ) : params.status}
          league={fixture?.league?.name || params.league}
          date={params.date}
          time={params.time}
          statusShort={fixture?.fixture.status.short}
          elapsed={fixture?.fixture.status.elapsed ?? undefined}
          stoppage={(fixture?.fixture.status as any)?.extra ?? null}
          startTimestamp={fixture?.fixture.status.short === '2H'
            ? (fixture?.fixture.periods.second || undefined)
            : (fixture?.fixture.periods.first || undefined)
          }
        />

        {/* Modern Tabs */}
        <ModernTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'events' && renderEvents()}
          {activeTab === 'lineups' && renderLineups()}
          {activeTab === 'stats' && renderStatistics()}
          {activeTab === 'form' && renderForm()}
          {activeTab === 'standings' && renderStandings()}
          {activeTab === 'stadium' && renderStadium()}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },
  customHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  lineupsContainer: {
    paddingBottom: 40,
  },
  substitutesSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  substitutesList: {
    marginBottom: 24,
  },
  substitutesTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  substitutesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  substituteCard: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  substituteNumber: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: 'bold',
  },
  substituteName: {
    color: '#fff',
    fontSize: 12,
  },
  substituteInfo: {
    justifyContent: 'center',
  },
  substitutePos: {
    color: '#888',
    fontSize: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#A855F7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  matchHeader: {
    alignItems: 'center',
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  matchTeam: {
    flex: 1,
    alignItems: 'center',
  },
  headerTeamLogo: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  headerTeamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  matchScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
  },
  scoreText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  scoreDivider: {
    color: '#666',
    fontSize: 20,
  },
  matchTime: {
    color: '#A855F7',
    fontSize: 18,
    fontWeight: 'bold',
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leagueLogo: {
    width: 20,
    height: 20,
  },
  leagueName: {
    color: '#888',
    fontSize: 12,
  },
  matchDate: {
    color: '#888',
    fontSize: 12,
  },
  tabsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    minWidth: 100,
  },
  activeTab: {
    backgroundColor: '#A855F7',
  },
  tabText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  teamLineupContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  teamLogo: {
    width: 60,
    height: 60,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  formationText: {
    color: '#A855F7',
    fontSize: 14,
    marginBottom: 2,
  },
  coachText: {
    color: '#888',
    fontSize: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  startingXIContainer: {
    marginBottom: 20,
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  playerCard: {
    width: (width - 80) / 3 - 8,
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 10,
  },
  playerNumber: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#A855F7',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  playerNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 6,
  },
  playerPhotoPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  playerPosition: {
    color: '#888',
    fontSize: 9,
  },
  substitutesContainer: {
    marginTop: 20,
  },
  substitutePosition: {
    color: '#888',
    fontSize: 10,
  },
  statsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsTeam: {
    flex: 1,
    alignItems: 'center',
  },
  statsTeamLogo: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  statsTeamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  statCenter: {
    flex: 1,
    alignItems: 'center',
  },
  statLabelContainer: {
    marginBottom: 8,
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  statBarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statBar: {
    height: 8,
    borderRadius: 4,
  },
  statBarHome: {
    backgroundColor: '#A855F7',
  },
  statBarAway: {
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-end',
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  formTeamLogo: {
    width: 50,
    height: 50,
  },
  formTeamName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formTitle: {
    color: '#888',
    fontSize: 12,
  },
  fixturesList: {
    gap: 12,
  },
  fixtureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  fixtureTeamLogo: {
    width: 40,
    height: 40,
  },
  fixtureInfo: {
    flex: 1,
  },
  fixtureOpponent: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fixtureLeague: {
    color: '#888',
    fontSize: 11,
  },
  fixtureResult: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  fixtureWin: {
    backgroundColor: '#22c55e',
  },
  fixtureLose: {
    backgroundColor: '#ef4444',
  },
  fixtureDraw: {
    backgroundColor: '#f59e0b',
  },
  fixtureScore: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  eventHome: {
    borderLeftWidth: 3,
    borderLeftColor: '#A855F7',
  },
  eventAway: {
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  eventTime: {
    minWidth: 50,
    alignItems: 'center',
  },
  eventTimeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventExtraTime: {
    color: '#888',
    fontSize: 11,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDetails: {
    flex: 1,
  },
  eventPlayer: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventType: {
    color: '#888',
    fontSize: 12,
    marginBottom: 2,
  },
  eventAssist: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
  },
  eventTeamLogo: {
    width: 30,
    height: 30,
  },
  standingsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 15,
  },
  standingsHeader: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 10,
  },
  standingsHeaderText: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  standingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  standingsRowHighlighted: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 8,
    marginHorizontal: -5,
    paddingHorizontal: 5,
  },
  standingsText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  stadiumContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  stadiumImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  stadiumInfo: {
    gap: 12,
  },
  stadiumName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stadiumDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stadiumDetailText: {
    color: '#888',
    fontSize: 14,
  },
});

export default MatchDetailsScreen;

