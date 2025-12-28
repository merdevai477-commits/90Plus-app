import React, { useState, useEffect, useRef } from 'react';
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
import ApiFootballService, { Lineup, TeamStatistics, TeamFixture, Fixture, FixtureEvent } from '../../services/apiFootball';
import { useLanguage } from '../../contexts/LanguageContext';
import { MatchHeader } from '../../components/match-details/MatchHeader';
import { ModernTabs } from '../../components/match-details/ModernTabs';
import { FootballField } from '../../components/match-details/FootballField';

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
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams() as unknown as MatchDetailsParams;

  // Safety check for translations
  if (!t || !t.matchDetails) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const [activeTab, setActiveTab] = useState<'lineups' | 'stats' | 'form' | 'events' | 'standings'>('events');

  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [statistics, setStatistics] = useState<TeamStatistics[]>([]);
  const [homeLastFixtures, setHomeLastFixtures] = useState<TeamFixture[]>([]);
  const [awayLastFixtures, setAwayLastFixtures] = useState<TeamFixture[]>([]);
  const [events, setEvents] = useState<FixtureEvent[]>([]);
  const [standings, setStandings] = useState<any[]>([]);

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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const fixtureId = parseInt(params.fixtureId || '0');

  useEffect(() => {
    // Reset state immediately when fixtureId changes to prevent stale data
    setEvents([]);
    setLineups([]);
    setStatistics([]);
    setHomeLastFixtures([]);
    setAwayLastFixtures([]);
    setStandings([]);
    setLoading(true);
    setError(null);
    setLineupsLoading(false);
    setStatsLoading(false);
    setFormLoading(false);
    setStandingsLoading(false);

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

  const loadMatchDetails = async () => {
    if (!fixtureId) {
      setError('معرف المباراة غير صحيح');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Reset specific loading states
      setLineupsLoading(true);
      setStatsLoading(true);
      setFormLoading(true);
      setStandingsLoading(true);

      console.log('🏁 Loading match details for fixture:', fixtureId);

      // 1. Start all independent requests in parallel
      const eventsPromise = ApiFootballService.getFixtureEvents(fixtureId);
      const lineupsPromise = ApiFootballService.getFixtureLineups(fixtureId);
      const statsPromise = ApiFootballService.getFixtureStatistics(fixtureId);
      const fixtureDetailsPromise = ApiFootballService.getFixtureById(fixtureId);

      // 2. Handle Events (Priority for initial render)
      eventsPromise
        .then(data => {
          console.log('✅ Events loaded:', data.length);
          setEvents(data);
          setLoading(false); // Show screen as soon as events are ready
        })
        .catch(err => {
          console.error('❌ Events error:', err);
          // Don't block the UI, just log
          setLoading(false);
        });

      // 3. Handle Lineups
      lineupsPromise
        .then(data => {
          console.log('✅ Lineups loaded:', data.length);
          setLineups(data);
        })
        .catch(err => {
          console.error('❌ Lineups error:', err);
          setLineupsError(err?.message || 'فشل تحميل التشكيلات');
        })
        .finally(() => setLineupsLoading(false));

      // 4. Handle Statistics
      statsPromise
        .then(data => {
          console.log('✅ Stats loaded:', data.length);
          setStatistics(data);
        })
        .catch(err => {
          console.error('❌ Stats error:', err);
          setStatsError(err?.message || 'فشل تحميل الإحصائيات');
        })
        .finally(() => setStatsLoading(false));

      // 5. Handle Fixture Details -> Form & Standings
      fixtureDetailsPromise
        .then(async (details) => {
          if (details) {
            const homeId = details.teams.home.id;
            const awayId = details.teams.away.id;
            const leagueId = details.league.id;
            const season = details.league.season;

            // Fetch Form (Last 5 Matches) in parallel
            Promise.allSettled([
              ApiFootballService.getTeamLastFixtures(homeId, 5),
              ApiFootballService.getTeamLastFixtures(awayId, 5)
            ]).then(([homeResult, awayResult]) => {
              if (homeResult.status === 'fulfilled') setHomeLastFixtures(homeResult.value);
              if (awayResult.status === 'fulfilled') setAwayLastFixtures(awayResult.value);
            }).finally(() => setFormLoading(false));

            // Fetch Standings
            ApiFootballService.getStandings(leagueId, season)
              .then(data => {
                console.log('✅ Standings loaded:', data.length);
                setStandings(data);
              })
              .catch(err => {
                console.error('❌ Standings error:', err);
                setStandingsError(err?.message || 'فشل تحميل الترتيب');
              })
              .finally(() => setStandingsLoading(false));
          } else {
            setFormLoading(false);
            setStandingsLoading(false);
          }
        })
        .catch(err => {
          console.error('❌ Fixture details error:', err);
          setFormLoading(false);
          setStandingsLoading(false);
        });

    } catch (err: any) {
      console.error('❌ Error initializing match details:', err);
      setError(err?.message || 'فشل تحميل تفاصيل المباراة');
      setLoading(false);
    }
  };

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
      'G': t.matchDetails.goalkeeper,
      'D': t.matchDetails.defender,
      'M': t.matchDetails.midfielder,
      'F': t.matchDetails.forward,
    };
    return positions[pos || ''] || pos || t.common.unknown || 'Unknown';
  };

  // Player Card Component with image error handling
  const PlayerCard = ({ player, number, position }: { player: any; number: number; position: string | null }) => {
    const [imageError, setImageError] = useState(false);

    return (
      <View style={styles.playerCard}>
        <View style={styles.playerNumber}>
          <Text style={styles.playerNumberText}>{number}</Text>
        </View>
        {player.photo && !imageError ? (
          <Image
            source={{ uri: player.photo }}
            style={styles.playerPhoto}
            onError={() => {
              console.log('Failed to load image for:', player.name);
              setImageError(true);
            }}
          />
        ) : (
          <View style={[styles.playerPhoto, styles.playerPhotoPlaceholder]}>
            <Ionicons name="person" size={24} color="#666" />
          </View>
        )}
        <Text style={styles.playerName} numberOfLines={2}>
          {player.name}
        </Text>
        <Text style={styles.playerPosition}>{getPositionName(position)}</Text>
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
                  {event.time.extra && (
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
                  <Text style={styles.eventPlayer}>{event.player.name}</Text>
                  <Text style={styles.eventType}>{getEventLabel(event.type, event.detail)}</Text>
                  {event.assist.name && (
                    <Text style={styles.eventAssist}>{t.matchDetails.assist}: {event.assist.name}</Text>
                  )}
                </View>

                <Image source={{ uri: event.team.logo }} style={styles.eventTeamLogo} />
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
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.emptyStateText}>{t.common.loading}</Text>
        </View>
      );
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
              // API-Football lineups endpoint might not return photo, so we construct it
              photo: item.player.photo || `https://media.api-sports.io/football/players/${item.player.id}.png`
            }));

            return (
              <View key={index} style={styles.teamLineupContainer}>
                <View style={styles.teamHeader}>
                  <Image source={{ uri: lineup.team.logo }} style={styles.teamLogo} />
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{lineup.team.name}</Text>
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
                  teamColor={index === 0 ? params.homeTeam === lineup.team.name ? '#22c55e' : '#3b82f6' : params.awayTeam === lineup.team.name ? '#3b82f6' : '#22c55e'}
                />

                {/* Substitutes */}
                {substitutes.length > 0 && (
                  <View style={styles.substitutesSection}>
                    <Text style={styles.substitutesTitle}>{t.matchDetails.substitutes}</Text>
                    <View style={styles.substitutesGrid}>
                      {substitutes.map((item: any) => (
                        <View key={item.player.id} style={styles.substituteCard}>
                          <Text style={styles.substituteNumber}>{item.player.number || '-'}</Text>
                          <View style={styles.substituteInfo}>
                            <Text style={styles.substituteName} numberOfLines={1}>{item.player.name}</Text>
                            <Text style={styles.substitutePos}>{item.player.pos}</Text>
                          </View>
                        </View>
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
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.emptyStateText}>{t.common.loading}</Text>
        </View>
      );
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
                <Text style={styles.statValue}>{homeValue || '0'}</Text>
                <View style={styles.statCenter}>
                  <Text style={styles.statLabel}>{stat.type}</Text>
                  <View style={styles.statBarsContainer}>
                    <View style={[styles.statBar, styles.statBarHome, { width: `${homePercentage}%` }]} />
                    <View style={[styles.statBar, styles.statBarAway, { width: `${awayPercentage}%` }]} />
                  </View>
                </View>
                <Text style={styles.statValue}>{awayValue || '0'}</Text>
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
            <Image source={{ uri: params.homeLogo }} style={styles.formTeamLogo} />
            <Text style={styles.formTeamName}>{params.homeTeam}</Text>
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

        {/* Away Team Last 5 Matches */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Image source={{ uri: params.awayLogo }} style={styles.formTeamLogo} />
            <Text style={styles.formTeamName}>{params.awayTeam}</Text>
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

  const renderStandings = () => {
    if (standingsLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.emptyStateText}>{t.common.loading}</Text>
        </View>
      );
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
                  <Text style={[styles.standingsText, { flex: 1, textAlign: 'left' }]} numberOfLines={1}>{team.team.name}</Text>
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
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
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
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          // Force navigation to Leagues (Matches) page as requested
          router.replace('/(tabs)/leagues');
        }}
      >
        <View style={styles.backButtonInner}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </View>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Modern Header */}
        <MatchHeader
          homeTeam={params.homeTeam}
          awayTeam={params.awayTeam}
          homeLogo={params.homeLogo}
          awayLogo={params.awayLogo}
          homeScore={params.homeScore}
          awayScore={params.awayScore}
          status={params.status}
          league={params.league}
          date={params.date}
          time={params.time}
        />

        {/* Modern Tabs */}
        <ModernTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as any)}
        />

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'events' && renderEvents()}
          {activeTab === 'lineups' && renderLineups()}
          {activeTab === 'stats' && renderStatistics()}
          {activeTab === 'form' && renderForm()}
          {activeTab === 'standings' && renderStandings()}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100,
    padding: 8,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#22c55e',
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
    backgroundColor: '#22c55e',
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
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
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
    color: '#22c55e',
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
    backgroundColor: '#22c55e',
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
    color: '#22c55e',
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
    backgroundColor: '#22c55e',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  playerNumberText: {
    color: '#000',
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
    backgroundColor: '#22c55e',
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
    borderLeftColor: '#22c55e',
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
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
    marginHorizontal: -5,
    paddingHorizontal: 5,
  },
  standingsText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default MatchDetailsScreen;

