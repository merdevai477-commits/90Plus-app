/**
 * MomentumPerformanceLab — __DEV__ only.
 * Route: /momentum-performance-lab
 *
 * Compares production-equivalent SVG chart vs Skia prototype with identical series.
 * Does not touch liveFixtureStore / polling / WebSocket / production match-details.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { MatchMomentumGraphSvgLab } from '../components/match-details/MatchMomentumGraphSvgLab';
import {
  MatchMomentumGraphSkia,
  applySkiaMomentumSeries,
  getSkiaMomentumLayout,
  useSkiaMomentumPathTargets,
} from '../components/match-details/MatchMomentumGraphSkia';
import {
  MOMENTUM_LAB_SCENARIOS,
  buildLabSeries,
  tickSeriesNoise,
  type MomentumLabScenarioId,
} from '../components/match-details/momentumLabFixtures';
import type { MomentumSeries } from '../utils/matchMomentum';
import { BG_MID, TEXT_MUTED, TEXT_PRIMARY, PURPLE_PRIMARY } from '../constants/tokens';

type ViewMode = 'side' | 'svg' | 'skia';
type HzOption = 0 | 1 | 5 | 10 | 30 | 60;

const HZ_OPTIONS: HzOption[] = [0, 1, 5, 10, 30, 60];
const EMPTY_EVENTS: never[] = [];

type Stats = {
  svgRenders: number;
  skiaRenders: number;
  updates: number;
  lastBatchMs: number;
  avgBatchMs: number;
};

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LabBody() {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(screenW - 32, 420);

  const [scenario, setScenario] = useState<MomentumLabScenarioId>('20');
  const [viewMode, setViewMode] = useState<ViewMode>('side');
  const [hz, setHz] = useState<HzOption>(0);
  const [highFreqSkia, setHighFreqSkia] = useState(true);
  /** SVG always follows this (React path). */
  const [svgSeries, setSvgSeries] = useState<MomentumSeries | null>(() => buildLabSeries('20'));
  /** Skia markers/layout series — stable during SharedValue high-freq stress. */
  const [skiaSeries, setSkiaSeries] = useState<MomentumSeries | null>(() => buildLabSeries('20'));
  const [stats, setStats] = useState<Stats>({
    svgRenders: 0,
    skiaRenders: 0,
    updates: 0,
    lastBatchMs: 0,
    avgBatchMs: 0,
  });

  const baseSeriesRef = useRef<MomentumSeries | null>(svgSeries);
  const tickRef = useRef(0);
  const batchSumRef = useRef(0);
  const batchCountRef = useRef(0);
  const svgRenderRef = useRef(0);
  const skiaRenderRef = useRef(0);
  const pathTargets = useSkiaMomentumPathTargets();

  const onSvgRenderPass = useCallback(() => {
    svgRenderRef.current += 1;
  }, []);
  const onSkiaRenderPass = useCallback(() => {
    skiaRenderRef.current += 1;
  }, []);

  const teams = useMemo(
    () => ({
      homeTeam: { name: 'Home FC' },
      awayTeam: { name: 'Away FC' },
    }),
    [],
  );

  const resetScenario = useCallback((id: MomentumLabScenarioId) => {
    const next = buildLabSeries(id);
    baseSeriesRef.current = next;
    tickRef.current = 0;
    batchSumRef.current = 0;
    batchCountRef.current = 0;
    svgRenderRef.current = 0;
    skiaRenderRef.current = 0;
    setScenario(id);
    setSvgSeries(next);
    setSkiaSeries(next);
    setStats({
      svgRenders: 0,
      skiaRenders: 0,
      updates: 0,
      lastBatchMs: 0,
      avgBatchMs: 0,
    });
    if (next) {
      applySkiaMomentumSeries(next, getSkiaMomentumLayout(cardW), pathTargets);
    }
  }, [cardW, pathTargets]);

  useEffect(() => {
    if (skiaSeries) {
      applySkiaMomentumSeries(skiaSeries, getSkiaMomentumLayout(cardW), pathTargets);
    }
  }, [skiaSeries, cardW, pathTargets]);

  // Live-update simulation — does not touch production polling.
  useEffect(() => {
    if (hz <= 0 || !baseSeriesRef.current) return;

    const intervalMs = Math.max(1, Math.round(1000 / hz));
    const id = setInterval(() => {
      const base = baseSeriesRef.current;
      if (!base) return;
      const t0 = globalThis.performance?.now?.() ?? Date.now();
      tickRef.current += 1;
      const next = tickSeriesNoise(base, tickRef.current);
      const t1 = globalThis.performance?.now?.() ?? Date.now();
      const dt = t1 - t0;
      batchSumRef.current += dt;
      batchCountRef.current += 1;

      // SVG must go through React to rebuild path strings.
      setSvgSeries(next);

      if (highFreqSkia) {
        // Skia areas via SharedValue — keep skiaSeries stable to avoid React re-renders.
        applySkiaMomentumSeries(next, getSkiaMomentumLayout(cardW), pathTargets);
      } else {
        setSkiaSeries(next);
      }

      // Throttle counter UI so stats setState does not force Skia React passes every tick.
      if (tickRef.current % Math.max(1, Math.ceil(hz / 2)) === 0) {
        setStats({
          svgRenders: svgRenderRef.current,
          skiaRenders: skiaRenderRef.current,
          updates: tickRef.current,
          lastBatchMs: dt,
          avgBatchMs: batchSumRef.current / batchCountRef.current,
        });
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [hz, highFreqSkia, cardW, pathTargets]);

  const showSvg = viewMode === 'side' || viewMode === 'svg';
  const showSkia = viewMode === 'side' || viewMode === 'skia';
  const series = svgSeries;

  if (!series && scenario !== '0') {
    return (
      <View style={styles.block}>
        <Text style={styles.note}>
          Scenario produced null series (coverage gate). Try 5+ events.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Momentum Performance Lab</Text>
      <Text style={styles.note}>
        Dev-only. Identical MomentumSeries for SVG vs Skia. Algorithm untouched. No live API /
        WS changes.
      </Text>

      <Text style={styles.section}>Scenario</Text>
      <View style={styles.rowWrap}>
        {MOMENTUM_LAB_SCENARIOS.map((s) => (
          <Chip
            key={s.id}
            label={s.label}
            active={scenario === s.id}
            onPress={() => resetScenario(s.id)}
          />
        ))}
      </View>

      <Text style={styles.section}>View</Text>
      <View style={styles.rowWrap}>
        {(
          [
            ['side', 'Side by side'],
            ['svg', 'SVG'],
            ['skia', 'Skia'],
          ] as const
        ).map(([id, label]) => (
          <Chip key={id} label={label} active={viewMode === id} onPress={() => setViewMode(id)} />
        ))}
      </View>

      <Text style={styles.section}>Live update Hz</Text>
      <View style={styles.rowWrap}>
        {HZ_OPTIONS.map((v) => (
          <Chip
            key={v}
            label={v === 0 ? 'Off' : `${v}/s`}
            active={hz === v}
            onPress={() => setHz(v)}
          />
        ))}
      </View>

      <Chip
        label={highFreqSkia ? 'Skia high-freq: SharedValue ON' : 'Skia high-freq: SharedValue OFF'}
        active={highFreqSkia}
        onPress={() => setHighFreqSkia((v) => !v)}
      />

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Counters (process / JS)</Text>
        <Text style={styles.statsLine}>Series updates: {stats.updates}</Text>
        <Text style={styles.statsLine}>SVG React render passes: {stats.svgRenders}</Text>
        <Text style={styles.statsLine}>Skia React render passes: {stats.skiaRenders}</Text>
        <Text style={styles.statsLine}>
          Last series mutate: {stats.lastBatchMs.toFixed(2)} ms (avg{' '}
          {stats.avgBatchMs.toFixed(2)} ms)
        </Text>
        <Text style={styles.statsHint}>
          FPS / UI-thread / memory: Not measured in this lab. Use a Release build + Xcode
          Instruments / Android GPU Inspector / RN Perf Monitor on device.
        </Text>
      </View>

      {showSvg && series ? (
        <View style={styles.block}>
          <Text style={styles.heading}>CURRENT SVG</Text>
          <MatchMomentumGraphSvgLab
            series={series}
            homeTeam={teams.homeTeam}
            awayTeam={teams.awayTeam}
            onRenderPass={onSvgRenderPass}
          />
        </View>
      ) : null}

      {showSkia && skiaSeries ? (
        <View style={styles.block}>
          <Text style={styles.heading}>SKIA PROTOTYPE</Text>
          <MatchMomentumGraphSkia
            events={EMPTY_EVENTS}
            seriesOverride={skiaSeries}
            highFreqPaths={highFreqSkia ? pathTargets : undefined}
            homeTeam={teams.homeTeam}
            awayTeam={teams.awayTeam}
            onRenderPass={onSkiaRenderPass}
          />
        </View>
      ) : null}

      {scenario === '0' || !series ? (
        <Text style={styles.note}>0-event / incomplete coverage → both charts hide (null).</Text>
      ) : null}
    </ScrollView>
  );
}

export default function MomentumPerformanceLabScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Not Available' }} />
        <Text style={styles.note}>Momentum Performance Lab is development-only.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Momentum Lab',
          headerStyle: { backgroundColor: '#111' },
          headerTintColor: '#fff',
        }}
      />
      <LabBody />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  scroll: {
    padding: 16,
    paddingBottom: 48,
    gap: 10,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '700',
  },
  note: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: BG_MID,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: {
    borderColor: PURPLE_PRIMARY,
    backgroundColor: 'rgba(124,58,237,0.25)',
  },
  chipText: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: TEXT_PRIMARY,
  },
  statsCard: {
    backgroundColor: BG_MID,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statsTitle: {
    color: TEXT_PRIMARY,
    fontWeight: '700',
    marginBottom: 4,
  },
  statsLine: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  statsHint: {
    color: TEXT_MUTED,
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
  },
  block: {
    marginTop: 8,
  },
  heading: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
});
