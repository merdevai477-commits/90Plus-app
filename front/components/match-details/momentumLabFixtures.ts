/**
 * Dev-only synthetic FixtureEvent sets for MomentumPerformanceLab.
 * Does not alter production momentum weights / smoothing.
 */

import type { FixtureEvent } from '../../services/apiFootball';
import {
  buildMomentumFromEvents,
  type MomentumSeries,
} from '../../utils/matchMomentum';

export const LAB_HOME_ID = 1001;
export const LAB_AWAY_ID = 1002;

type EventSeed = {
  minute: number;
  extra?: number;
  side: 'home' | 'away';
  type: FixtureEvent['type'];
  detail: string;
};

function makeEvent(seed: EventSeed, index: number): FixtureEvent {
  const teamId = seed.side === 'home' ? LAB_HOME_ID : LAB_AWAY_ID;
  return {
    time: { elapsed: seed.minute, extra: seed.extra ?? null },
    team: { id: teamId, name: seed.side === 'home' ? 'Home FC' : 'Away FC', logo: '' },
    player: { id: index, name: `P${index}` },
    assist: { id: null, name: null },
    type: seed.type,
    detail: seed.detail,
    comments: null,
  };
}

function seedsToEvents(seeds: EventSeed[]): FixtureEvent[] {
  return seeds.map(makeEvent);
}

const SCENARIO_0: EventSeed[] = [];

const SCENARIO_5: EventSeed[] = [
  { minute: 12, side: 'home', type: 'Goal', detail: 'Normal Goal' },
  { minute: 28, side: 'away', type: 'Card', detail: 'Yellow Card' },
  { minute: 41, side: 'home', type: 'Card', detail: 'Yellow Card' },
  { minute: 67, side: 'away', type: 'Goal', detail: 'Normal Goal' },
  { minute: 84, side: 'home', type: 'subst', detail: 'Substitution 1' },
];

const SCENARIO_20: EventSeed[] = [
  ...SCENARIO_5,
  { minute: 7, side: 'away', type: 'Card', detail: 'Yellow Card' },
  { minute: 19, side: 'home', type: 'Var', detail: 'Goal cancelled' },
  { minute: 33, side: 'away', type: 'Goal', detail: 'Penalty' },
  { minute: 38, side: 'home', type: 'Card', detail: 'Red Card' },
  { minute: 46, side: 'away', type: 'subst', detail: 'Substitution 1' },
  { minute: 52, side: 'home', type: 'Goal', detail: 'Normal Goal' },
  { minute: 58, side: 'away', type: 'Card', detail: 'Yellow Card' },
  { minute: 63, side: 'home', type: 'subst', detail: 'Substitution 2' },
  { minute: 71, side: 'away', type: 'Var', detail: 'Penalty confirmed' },
  { minute: 76, side: 'home', type: 'Card', detail: 'Yellow Card' },
  { minute: 81, side: 'away', type: 'subst', detail: 'Substitution 2' },
  { minute: 88, side: 'home', type: 'Goal', detail: 'Normal Goal' },
  { minute: 90, extra: 2, side: 'away', type: 'Card', detail: 'Yellow Card' },
  { minute: 90, extra: 4, side: 'home', type: 'Goal', detail: 'Normal Goal' },
  { minute: 55, side: 'away', type: 'Goal', detail: 'Own Goal' },
];

function denseSeeds(count: number, maxMinute: number): EventSeed[] {
  const types: { type: FixtureEvent['type']; detail: string }[] = [
    { type: 'Goal', detail: 'Normal Goal' },
    { type: 'Card', detail: 'Yellow Card' },
    { type: 'Card', detail: 'Red Card' },
    { type: 'Var', detail: 'Goal cancelled' },
    { type: 'subst', detail: 'Substitution 1' },
    { type: 'Goal', detail: 'Penalty' },
  ];
  const out: EventSeed[] = [];
  for (let i = 0; i < count; i++) {
    const t = types[i % types.length];
    const minute = Math.round((i / Math.max(1, count - 1)) * maxMinute);
    out.push({
      minute: Math.max(1, minute),
      side: i % 2 === 0 ? 'home' : 'away',
      type: t.type,
      detail: t.detail,
    });
  }
  return out;
}

export type MomentumLabScenarioId =
  | '0'
  | '5'
  | '20'
  | '50'
  | '90'
  | '120'
  | 'dense';

export const MOMENTUM_LAB_SCENARIOS: {
  id: MomentumLabScenarioId;
  label: string;
}[] = [
  { id: '0', label: '0 events' },
  { id: '5', label: '5 events' },
  { id: '20', label: '20 events' },
  { id: '50', label: '50 events' },
  { id: '90', label: '90′ match' },
  { id: '120', label: '105/120′' },
  { id: 'dense', label: 'Dense' },
];

export function buildLabEvents(scenario: MomentumLabScenarioId): FixtureEvent[] {
  switch (scenario) {
    case '0':
      return seedsToEvents(SCENARIO_0);
    case '5':
      return seedsToEvents(SCENARIO_5);
    case '20':
      return seedsToEvents(SCENARIO_20);
    case '50':
      return seedsToEvents(denseSeeds(50, 90));
    case '90':
      return seedsToEvents(denseSeeds(24, 90));
    case '120':
      return seedsToEvents([
        ...denseSeeds(30, 90),
        { minute: 95, side: 'home', type: 'Goal', detail: 'Normal Goal' },
        { minute: 102, side: 'away', type: 'Card', detail: 'Yellow Card' },
        { minute: 105, side: 'home', type: 'subst', detail: 'Substitution 3' },
        { minute: 110, side: 'away', type: 'Goal', detail: 'Normal Goal' },
        { minute: 118, side: 'home', type: 'Var', detail: 'Goal confirmed' },
      ]);
    case 'dense':
      return seedsToEvents(denseSeeds(40, 90));
    default:
      return seedsToEvents(SCENARIO_20);
  }
}

export function buildLabSeries(
  scenario: MomentumLabScenarioId,
  opts?: { matchElapsed?: number; finished?: boolean },
): MomentumSeries | null {
  const events = buildLabEvents(scenario);
  const finished = opts?.finished ?? (scenario === '90' || scenario === '120' || scenario === 'dense');
  const matchElapsed =
    opts?.matchElapsed ??
    (scenario === '120' ? 120 : scenario === '90' || finished ? 90 : 78);

  return buildMomentumFromEvents({
    events,
    homeTeamId: LAB_HOME_ID,
    awayTeamId: LAB_AWAY_ID,
    homeGoals: events.filter((e) => e.type === 'Goal' && e.team?.id === LAB_HOME_ID).length,
    awayGoals: events.filter((e) => e.type === 'Goal' && e.team?.id === LAB_AWAY_ID).length,
    matchElapsed,
    finished,
  });
}

/** Mutate pressure slightly for live-update stress without rebuilding events. */
export function tickSeriesNoise(series: MomentumSeries, tick: number): MomentumSeries {
  const wobble = Math.sin(tick / 3) * 4 + Math.cos(tick / 5) * 2;
  return {
    ...series,
    home: series.home.map((v, i) =>
      Math.min(100, Math.max(0, v + wobble * Math.sin((i + tick) / 11))),
    ),
    away: series.away.map((v, i) =>
      Math.min(100, Math.max(0, v - wobble * Math.cos((i + tick) / 13))),
    ),
  };
}
