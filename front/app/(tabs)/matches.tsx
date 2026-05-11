import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, Platform, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { Bell, Star, ChevronDown, Calendar, Ticket } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { MainShell } from '../../components/Matches/MainShell';
import { TEXT_PRIMARY, PURPLE_PRIMARY } from '../../constants/tokens';
import { useMatchesData } from '../../hooks/useMatchesData';
import { PredictionsService } from '../../services/predictions.service';
import { toastManager } from '../../services/toastManager';
import type { Match } from '../../components/Matches/matchCardUtils';

const FILTERS = ['All', 'Live', 'Upcoming', 'Finished', 'Predictions'] as const;

// Map API match status to display status
function mapStatus(status: string): 'LIVE' | 'FT' | 'UPCOMING' {
  if (status === 'live') return 'LIVE';
  if (status === 'finished') return 'FT';
  return 'UPCOMING';
}

type Fixture = {
  id: string;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  homeScore: number;
  awayScore: number;
  status: 'LIVE' | 'FT' | 'UPCOMING';
  minute?: string;
  live?: boolean;
  time?: string;
  leagueName?: string;
  leagueLogo?: string;
  matchDate?: string;
};

type LeagueGroup = {
  id: string;
  league: string;
  leagueLogo: string;
  liveLabel: string;
  fixtures: Fixture[];
};

function PredictionButton({ 
  label, 
  isActive, 
  onPress, 
  activeColor,
  activeGradient,
  disabled,
}: { 
  label: string; 
  isActive: boolean; 
  onPress: () => void;
  activeColor: string;
  activeGradient: readonly [string, string];
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity 
      style={[
        styles.predBtn, 
        isActive && { borderColor: activeColor, transform: [{ scale: 1.02 }] },
        disabled && { opacity: 0.5 },
      ]} 
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: 10, overflow: 'hidden' }]}>
        {isLiquidGlassSupported ? (
          <LiquidGlassView 
            {...({
              style: StyleSheet.absoluteFill,
              tint: "rgba(20,15,30,0.65)",
              effect: "clear"
            } as any)}
          />
        ) : (
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        {isActive && (
          <LinearGradient 
            colors={activeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>
      <Text style={[styles.predBtnTxt, isActive && { color: '#fff', textShadowColor: activeColor, textShadowRadius: 8, textShadowOffset: {width: 0, height: 0} }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MatchRow({ 
  fixture, 
  showPreds,
  onPredict,
  submittingId,
  predictedMatches,
}: { 
  fixture: Fixture;
  showPreds: boolean;
  onPredict: (fixtureId: string, type: 'home' | 'draw' | 'away') => void;
  submittingId: string | null;
  predictedMatches: Record<string, 'home' | 'draw' | 'away'>;
}) {
  const [bellActive, setBellActive] = useState(false);
  const existingPrediction = predictedMatches[fixture.id] ?? null;
  const isSubmitting = submittingId === fixture.id;

  return (
    <View style={styles.rowWrapCol}>
      <View style={styles.rowWrap}>
        <TouchableOpacity style={styles.rowIcon} activeOpacity={0.7}>
          <Star size={16} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>
        <View style={styles.rowBody}>
          <View style={styles.teamCol}>
            <View style={styles.logoStub}>
              {fixture.homeLogo ? (
                <Image source={{ uri: fixture.homeLogo }} style={styles.teamLogo} resizeMode="contain" />
              ) : null}
            </View>
            <Text style={styles.teamTxt} numberOfLines={1}>{fixture.home}</Text>
          </View>
          <View style={styles.scoreCol}>
            {fixture.status === 'UPCOMING' ? (
              <View style={styles.upcomingBadgeWrap}><Text style={styles.upcomingBadge}>UPCOMING</Text></View>
            ) : fixture.live ? <Text style={styles.liveBadge}>LIVE</Text> : <Text style={styles.ftBadge}>FT</Text>}
            
            {fixture.status === 'UPCOMING' ? (
              <Text style={styles.timeTxt}>{fixture.time}</Text>
            ) : (
              <Text style={styles.scoreTxt} numberOfLines={1} adjustsFontSizeToFit>
                {fixture.homeScore}<Text style={styles.scoreDash}>-</Text>{fixture.awayScore}
              </Text>
            )}
            <Text style={styles.minuteTxt}>{fixture.minute ?? ''}</Text>
          </View>
          <View style={styles.teamCol}>
            <View style={styles.logoStub}>
              {fixture.awayLogo ? (
                <Image source={{ uri: fixture.awayLogo }} style={styles.teamLogo} resizeMode="contain" />
              ) : null}
            </View>
            <Text style={styles.teamTxt} numberOfLines={1}>{fixture.away}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.rowIcon} activeOpacity={0.7} onPress={() => setBellActive(!bellActive)}>
          <Bell size={16} color={bellActive ? "#fbbf24" : "rgba(255,255,255,0.45)"} fill={bellActive ? "#fbbf24" : "transparent"} />
        </TouchableOpacity>
      </View>
      
      {showPreds && fixture.status === 'UPCOMING' && (
        <View style={styles.predWrap}>
          {existingPrediction ? (
            <View style={styles.predDoneWrap}>
              <Text style={styles.predDoneIcon}>✅</Text>
              <Text style={styles.predDoneTxt}>
                Predicted: {existingPrediction === 'home' ? fixture.home : existingPrediction === 'away' ? fixture.away : 'Draw'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.predTitle}>Make Your Prediction</Text>
              <View style={styles.predButtons}>
                {isSubmitting ? (
                  <ActivityIndicator color={PURPLE_PRIMARY} style={{ flex: 1, height: 44 }} />
                ) : (
                  <>
                    <PredictionButton 
                      label={fixture.home} 
                      isActive={false}
                      onPress={() => onPredict(fixture.id, 'home')} 
                      activeColor="rgba(59,130,246,0.6)" 
                      activeGradient={['rgba(59,130,246,0.45)', 'rgba(37,99,235,0.15)']}
                    />
                    <PredictionButton 
                      label="Draw" 
                      isActive={false}
                      onPress={() => onPredict(fixture.id, 'draw')} 
                      activeColor="rgba(156,163,175,0.6)" 
                      activeGradient={['rgba(156,163,175,0.45)', 'rgba(107,114,128,0.15)']}
                    />
                    <PredictionButton 
                      label={fixture.away} 
                      isActive={false}
                      onPress={() => onPredict(fixture.id, 'away')} 
                      activeColor="rgba(239,68,68,0.6)" 
                      activeGradient={['rgba(239,68,68,0.45)', 'rgba(220,38,38,0.15)']}
                    />
                  </>
                )}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function LeagueCard({ 
  group, 
  filter,
  onPredict,
  submittingId,
  predictedMatches,
}: { 
  group: LeagueGroup;
  filter: string;
  onPredict: (fixtureId: string, type: 'home' | 'draw' | 'away') => void;
  submittingId: string | null;
  predictedMatches: Record<string, 'home' | 'draw' | 'away'>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const liveCount = group.fixtures.filter(f => f.live).length;

  return (
    <View style={styles.leagueCard}>
      <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardShine}
      />
      <TouchableOpacity 
        style={styles.leagueHead}
        activeOpacity={0.7}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.leagueLeft}>
          <View style={styles.leagueLogoWrap}>
            {group.leagueLogo ? (
              <Image source={{ uri: group.leagueLogo }} style={styles.leagueLogo} resizeMode="contain" />
            ) : null}
          </View>
          <Text style={styles.leagueTitle}>{group.league}</Text>
        </View>
        <View style={styles.leagueRight}>
          {liveCount > 0 && <Text style={styles.leagueLive}>Live {liveCount}</Text>}
          <ChevronDown 
            size={15} 
            color="rgba(255,255,255,0.45)" 
            style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
          />
        </View>
      </TouchableOpacity>
      
      {isExpanded && (
        <>
          {group.fixtures.map((fixture) => (
            <MatchRow 
              key={fixture.id} 
              fixture={fixture} 
              showPreds={filter === 'Predictions'}
              onPredict={onPredict}
              submittingId={submittingId}
              predictedMatches={predictedMatches}
            />
          ))}
          <TouchableOpacity activeOpacity={0.8} style={styles.viewAllBtn}>
            <Text style={styles.viewAllTxt}>View All  ›</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export default function MatchesHubScreenV2() {
  const params = useLocalSearchParams();
  const initialFilter = (params.filter as typeof FILTERS[number]) || 'All';
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(initialFilter);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTicketsInfo, setShowTicketsInfo] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(14); // calendar selected day index
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  // Tickets (remaining predictions)
  const [ticketsRemaining, setTicketsRemaining] = useState<number>(10);
  // Map of matchId -> prediction type already submitted
  const [predictedMatches, setPredictedMatches] = useState<Record<string, 'home' | 'draw' | 'away'>>({});
  // Which match is currently being submitted
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Real matches data from backend
  const { groupedMatches, loading, error, refetch } = useMatchesData(selectedDate);

  // Load tickets count and existing predictions on mount
  useEffect(() => {
    const loadPredictionsData = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const [remaining, userPreds] = await Promise.all([
          PredictionsService.getRemainingPredictions(token),
          PredictionsService.getUserPredictions(token),
        ]);
        setTicketsRemaining(remaining.remaining);
        // Build map of matchId -> predictionType from existing predictions
        const map: Record<string, 'home' | 'draw' | 'away'> = {};
        Object.entries(userPreds.predictionsMap).forEach(([matchId, pred]) => {
          map[matchId] = pred.prediction.type;
        });
        setPredictedMatches(map);
      } catch {
        // silently fail — tickets will show default
      }
    };
    loadPredictionsData();
  }, [getToken]);

  useEffect(() => {
    if (params.filter && FILTERS.includes(params.filter as any)) {
      setFilter(params.filter as typeof FILTERS[number]);
    }
  }, [params.filter]);

  // Convert groupedMatches from hook to LeagueGroup format for the UI
  const groups = useMemo((): LeagueGroup[] => {
    const allGroups: LeagueGroup[] = groupedMatches.map(g => ({
      id: String(g.leagueId),
      league: g.leagueName,
      leagueLogo: g.leagueLogo || '',
      liveLabel: 'Live',
      fixtures: g.matches.map((m: Match): Fixture => ({
        id: m.id,
        home: m.homeTeam?.name || 'Home',
        away: m.awayTeam?.name || 'Away',
        homeLogo: m.homeTeam?.logo || '',
        awayLogo: m.awayTeam?.logo || '',
        homeScore: m.score?.home ?? 0,
        awayScore: m.score?.away ?? 0,
        status: mapStatus(m.status),
        minute: m.minute,
        live: m.status === 'live',
        time: m.time,
        leagueName: m.league?.name,
        leagueLogo: m.league?.logo,
        matchDate: m.fixtureDate,
      })),
    }));

    // Apply filter
    if (filter === 'Live') {
      return allGroups.map(g => ({ ...g, fixtures: g.fixtures.filter(f => f.live) })).filter(g => g.fixtures.length > 0);
    }
    if (filter === 'Upcoming' || filter === 'Predictions') {
      return allGroups.map(g => ({ ...g, fixtures: g.fixtures.filter(f => f.status === 'UPCOMING') })).filter(g => g.fixtures.length > 0);
    }
    if (filter === 'Finished') {
      return allGroups.map(g => ({ ...g, fixtures: g.fixtures.filter(f => f.status === 'FT') })).filter(g => g.fixtures.length > 0);
    }
    return allGroups;
  }, [groupedMatches, filter]);

  // Handle prediction submission
  //
  // Flow:
  //  1. Check ticket count (local state) — show warning toast if 0
  //  2. Check if already predicted — silent no-op
  //  3. Optimistic UI update: mark predicted + decrement ticket count
  //  4. Call backend; on failure, roll back the optimistic change
  //  5. Show success/error toast
  const handlePredict = useCallback(async (fixtureId: string, type: 'home' | 'draw' | 'away') => {
    if (ticketsRemaining <= 0) {
      toastManager.showWarning(
        'لا توجد تذاكر',
        'انتهت تذاكر التوقع لليوم. تتجدد كل 24 ساعة تلقائياً.',
      );
      return;
    }
    if (predictedMatches[fixtureId]) return; // already predicted — no-op

    // Find fixture details BEFORE optimistic update (used for both API + toast)
    let fixtureDetails: Fixture | undefined;
    for (const g of groups) {
      const found = g.fixtures.find(f => f.id === fixtureId);
      if (found) { fixtureDetails = found; break; }
    }

    // Optimistic UI update — instant feedback
    setPredictedMatches(prev => ({ ...prev, [fixtureId]: type }));
    setTicketsRemaining(prev => Math.max(0, prev - 1));
    setSubmittingId(fixtureId);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      await PredictionsService.submitPrediction(token, {
        apiMatchId: fixtureId,
        predictionType: type,
        homeTeam: fixtureDetails?.home || '',
        awayTeam: fixtureDetails?.away || '',
        homeTeamLogo: fixtureDetails?.homeLogo,
        awayTeamLogo: fixtureDetails?.awayLogo,
        matchDate: fixtureDetails?.matchDate || new Date().toISOString(),
        leagueName: fixtureDetails?.leagueName,
      });

      // Success — show toast
      toastManager.showPredictionSuccess();
    } catch (err: any) {
      const msg = err?.message || 'Failed to submit prediction';

      // Already predicted: server has a record, UI state is correct — don't roll back.
      if (msg.includes('Already predicted')) {
        toastManager.showInfo('تم التوقع مسبقاً', 'لقد توقعت على هذه المباراة قبل ذلك');
        return;
      }

      // Anything else — roll back the optimistic update
      setPredictedMatches(prev => {
        const next = { ...prev };
        delete next[fixtureId];
        return next;
      });
      setTicketsRemaining(prev => prev + 1);

      if (msg.includes('Daily prediction limit')) {
        toastManager.showWarning(
          'انتهت تذاكر اليوم',
          'استخدمت كل تذاكر التوقع لليوم. تتجدد كل 24 ساعة تلقائياً.',
        );
      } else {
        toastManager.showPredictionError();
      }
    } finally {
      setSubmittingId(null);
    }
  }, [ticketsRemaining, predictedMatches, groups, getToken]);

  const headerRight = (() => {
    const isEmpty = ticketsRemaining <= 0;
    // When empty: icon + text turn black-ish, and the subtle purple wash/glow go away.
    const iconColor = isEmpty ? '#1a1a1a' : '#d8b4fe';
    const iconShadowColor = isEmpty ? 'transparent' : '#a855f7';
    const gradientColors = isEmpty
      ? (['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.0)'] as const)
      : (['rgba(168,85,247,0.15)', 'transparent'] as const);

    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => setShowTicketsInfo(true)}>
        <View style={styles.ticketsOuter}>
          <View style={styles.ticketsInner}>
            {isLiquidGlassSupported ? (
              <LiquidGlassView {...({ style: StyleSheet.absoluteFill, tint: 'rgba(255,255,255,0.00)', effect: 'clear' } as any)} />
            ) : (
              <BlurView intensity={0} tint="light" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
            <View style={{ shadowColor: iconShadowColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: isEmpty ? 0 : 0.8, shadowRadius: 8, elevation: isEmpty ? 0 : 4 }}>
              <Ticket size={18} color={iconColor} />
            </View>
            <Text style={[styles.ticketsTxt, isEmpty && styles.ticketsTxtEmpty]}>{ticketsRemaining}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  })();

  const FloatingHeader = isLiquidGlassSupported ? LiquidGlassView : BlurView;

  return (
    <View style={{ flex: 1 }}>
      <FloatingHeader
        {...(isLiquidGlassSupported ? { effect: 'clear', tint: 'rgba(5,1,13,0.1)' } as any : { intensity: 15, tint: 'dark' })}
        style={[styles.floatingHeader, { paddingTop: Math.max(insets.top, 10) + 10 }]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.logoPillSmall}>
            <Text style={styles.logo90Small}>90</Text>
            <View style={styles.plusChipSmall}>
              <Text style={styles.logoPlusSmall}>PLUS</Text>
            </View>
          </View>
          <Text style={styles.headerTitleTxt}>Live Score</Text>
        </View>
        <View style={{ flex: 1 }} />
        {headerRight}
      </FloatingHeader>
      <MainShell title=" " subtitle=" ">
        <View style={styles.tabsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll} style={{ flex: 1, marginRight: 10 }}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity key={f} onPress={() => setFilter(f)} activeOpacity={0.85} style={[styles.tabChip, active && styles.tabChipActive]}>
                {isLiquidGlassSupported ? (
                  <LiquidGlassView 
                    {...({
                      style: [StyleSheet.absoluteFill, { borderRadius: 11 }],
                      tint: "rgba(20,15,30,0.65)",
                      effect: "clear"
                    } as any)}
                  />
                ) : (
                  <BlurView intensity={25} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 11 }]} />
                )}
                {active ? (
                  <LinearGradient colors={['rgba(168,85,247,0.7)', 'rgba(147,51,234,0.4)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 11 }]} />
                ) : null}
                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{f}</Text>
                {f === 'Live' && filter !== 'Live' ? <View style={styles.liveDot} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.calendarBtn} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
          {isLiquidGlassSupported ? (
            <LiquidGlassView {...({style: StyleSheet.absoluteFill, tint: 'rgba(20,15,30,0.65)', effect: 'clear'} as any)} />
          ) : (
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <Calendar size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={[
          styles.modalOverlay,
          Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' }
        ]}>
          <BlurView 
            intensity={Platform.OS === 'ios' ? 30 : 100} 
            tint="dark" 
            style={StyleSheet.absoluteFill} 
          />
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowCalendar(false)} activeOpacity={1} />
          <View style={styles.calendarModalOuter}>
            <View style={styles.calendarModalInner}>
              {isLiquidGlassSupported ? (
                <LiquidGlassView {...({style: StyleSheet.absoluteFill, tint: 'rgba(15,5,25,0.99)', effect: 'regular'} as any)} />
              ) : (
                <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient 
                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.01)', 'rgba(0,0,0,0.5)']} 
                start={{x: 0, y: 0}} end={{x: 1, y: 1}} 
                style={StyleSheet.absoluteFill} 
                pointerEvents="none" 
              />
              <View style={styles.calHeader}>
                <Text style={styles.calTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowCalendar(false)}>
                  <Text style={styles.calClose}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.calBody}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <Text key={d} style={styles.calDayName}>{d}</Text>)}
                {Array.from({length: 31}).map((_, i) => (
                  <TouchableOpacity key={i} style={[styles.calDay, i === selectedDay && styles.calDayActive]} onPress={() => {
                    setSelectedDay(i);
                    const d = new Date();
                    d.setDate(i + 1);
                    setSelectedDate(d);
                    setShowCalendar(false);
                  }}>
                    {i === selectedDay && (
                      <LinearGradient 
                        colors={['rgba(168,85,247,0.9)', 'rgba(126,34,206,0.6)']} 
                        style={StyleSheet.absoluteFill} 
                        start={{x:0, y:0}} end={{x:1, y:1}} 
                      />
                    )}
                    <Text style={[styles.calDayTxt, i === selectedDay && {color: '#fff', textShadowColor: 'rgba(255,255,255,0.5)', textShadowRadius: 10}]}>{i + 1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTicketsInfo} transparent animationType="fade">
        <View style={[
          styles.modalOverlay,
          Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' }
        ]}>
          <BlurView 
            intensity={Platform.OS === 'ios' ? 30 : 100} 
            tint="dark" 
            style={StyleSheet.absoluteFill} 
          />
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowTicketsInfo(false)} activeOpacity={1} />
          
          <View style={styles.ticketsInfoModalOuter}>
            <View style={styles.ticketsInfoModalInner}>
              {isLiquidGlassSupported ? (
                <LiquidGlassView {...({style: StyleSheet.absoluteFill, tint: 'rgba(15,5,25,0.99)', effect: 'regular'} as any)} />
              ) : (
                <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient 
                colors={['rgba(168,85,247,0.15)', 'rgba(0,0,0,0.5)']} 
                start={{x: 0, y: 0}} end={{x: 1, y: 1}} 
                style={StyleSheet.absoluteFill} 
                pointerEvents="none" 
              />
              
              <View style={styles.infoIconWrap}>
                <View style={{ shadowColor: '#a855f7', shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.8, shadowRadius: 10, elevation: 6 }}>
                  <Ticket size={32} color="#d8b4fe" />
                </View>
              </View>
              
              <Text style={styles.infoTitle}>Match Tickets</Text>
              
              <View style={styles.infoRow}>
                <View style={styles.infoDot} />
                <Text style={styles.infoText}>1 Ticket = 1 Match Prediction</Text>
              </View>
              
              <View style={styles.infoRow}>
                <View style={styles.infoDot} />
                <Text style={styles.infoText}>Tickets renew automatically every 24 hours.</Text>
              </View>

              <TouchableOpacity style={styles.infoBtn} onPress={() => setShowTicketsInfo(false)} activeOpacity={0.8}>
                <LinearGradient colors={['#a855f7', '#7e22ce']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={StyleSheet.absoluteFill} />
                <Text style={styles.infoBtnTxt}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.groupsWrap}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={PURPLE_PRIMARY} />
            <Text style={styles.loadingTxt}>Loading matches...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorTxt}>⚠️ {error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.7}>
              <Text style={styles.retryTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTxt}>No matches found</Text>
          </View>
        ) : (
          groups.map((group) => (
            <LeagueCard 
              key={group.id} 
              group={group} 
              filter={filter}
              onPredict={handlePredict}
              submittingId={submittingId}
              predictedMatches={predictedMatches}
            />
          ))
        )}
      </View>
    </MainShell>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoPillSmall: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 5,
  },
  logo90Small: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  plusChipSmall: { backgroundColor: PURPLE_PRIMARY, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  logoPlusSmall: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  headerTitleTxt: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  tabsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 24 },
  tabsScroll: { gap: 8, paddingRight: 6 },
  ticketsOuter: { shadowColor: '#000000ff', shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
  ticketsInner: { height: 40, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(84, 13, 151, 0)', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, overflow: 'hidden' },
  ticketsTxt: { color: '#e9d5ff', fontSize: 16, fontWeight: '800', textShadowColor: '#a855f7', textShadowRadius: 8, zIndex: 1 },
  ticketsTxtEmpty: { color: '#1a1a1a', textShadowColor: 'transparent' },
  calendarBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tabChip: {
    minWidth: 62, height: 38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 14, overflow: 'hidden', flexDirection: 'row', gap: 6,
  },
  tabChipActive: { borderColor: 'rgba(167,139,250,0.55)' },
  tabTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700', zIndex: 1 },
  tabTxtActive: { color: '#fff' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  filterBtn: {
    width: 42, height: 38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  groupsWrap: { gap: 14 },
  leagueCard: {
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(12,10,20,0.65)', overflow: 'hidden',
  },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  leagueHead: {
    height: 46, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  leagueLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  leagueLogoWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leagueLogo: { width: 14, height: 14 },
  leagueTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  leagueRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leagueLive: { color: PURPLE_PRIMARY, fontSize: 14, fontWeight: '700' },
  rowWrap: {
    minHeight: 94, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  rowBody: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8,
  },
  teamCol: { width: '34%', alignItems: 'center', gap: 6 },
  logoStub: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center',
  },
  teamLogo: { width: 25, height: 25 },
  teamTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', maxWidth: '100%' },
  scoreCol: { width: '32%', alignItems: 'center' },
  liveBadge: { color: '#ef4444', fontSize: 11, fontWeight: '900', backgroundColor: 'rgba(239,68,68,0.14)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' },
  ftBadge: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '800' },
  scoreTxt: {
    marginTop: 4, color: '#fff', fontSize: 34, lineHeight: 36, fontWeight: '900',
    letterSpacing: -1, fontVariant: ['tabular-nums'],
  },
  scoreDash: { color: 'rgba(255,255,255,0.45)' },
  minuteTxt: { marginTop: 2, color: PURPLE_PRIMARY, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  viewAllBtn: { height: 44, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  viewAllTxt: { color: PURPLE_PRIMARY, fontSize: 15, fontWeight: '800' },
  rowWrapCol: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  upcomingBadgeWrap: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  upcomingBadge: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
  timeTxt: { marginTop: 4, color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 0, fontVariant: ['tabular-nums'] },
  predWrap: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  predTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', marginBottom: 10, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  predButtons: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  predBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  predBtnTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '800', textAlign: 'center', zIndex: 1 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  calendarModalOuter: { width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.8, shadowRadius: 35, elevation: 20 },
  calendarModalInner: { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', padding: 24 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, zIndex: 1 },
  calTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  calClose: { color: PURPLE_PRIMARY, fontSize: 16, fontWeight: '700' },
  calBody: { flexDirection: 'row', flexWrap: 'wrap', gap: '2%', zIndex: 1 },
  calDayName: { width: '12%', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  calDay: { width: '12%', height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  calDayActive: { borderColor: 'rgba(168,85,247,0.5)', borderWidth: 1 },
  calDayTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600', zIndex: 1 },
  ticketsInfoModalOuter: { width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.8, shadowRadius: 35, elevation: 20 },
  ticketsInfoModalInner: { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)', overflow: 'hidden', padding: 24, alignItems: 'center' },
  infoIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(168,85,247,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' },
  infoTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 20, letterSpacing: -0.3 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginBottom: 12, gap: 10, paddingRight: 10 },
  infoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a855f7', marginTop: 7 },
  infoText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22, flex: 1 },
  infoBtn: { width: '100%', height: 48, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  infoBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Loading / Error / Empty
  loadingWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  errorWrap: { alignItems: 'center', paddingVertical: 40, gap: 16 },
  errorTxt: { color: 'rgba(255,100,100,0.8)', fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: 'rgba(168,85,247,0.2)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)' },
  retryTxt: { color: '#d8b4fe', fontSize: 14, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyTxt: { color: 'rgba(255,255,255,0.3)', fontSize: 15 },

  // Prediction done state
  predDoneWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  predDoneIcon: { fontSize: 16 },
  predDoneTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
});
