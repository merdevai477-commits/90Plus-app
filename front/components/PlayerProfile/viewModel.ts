import type { Player365Career, Player365CareerHighlightStat } from '../../services/apiFootball';
import type {
  PlayerDetailedStats,
  PlayerPer90Stats,
  PlayerSeasonSummary,
  PlayerTransferRow,
} from './types';

const SHOTS_ON_TARGET_TYPE = 35;
const CHANCES_CREATED_TYPE = 212;
const TOTAL_SHOTS_TYPE = 3;
const PASS_ACCURACY_TYPE = 19;
const DRIBBLES_TYPE = 13;
const KEY_PASSES_TYPE = 20;
const XG_TYPE = 76;

function parseStat(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const pct = String(value).match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return Number.parseFloat(pct[1]);
  const n = Number.parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function flattenHighlights(career: Player365Career): Player365CareerHighlightStat[] {
  const out: Player365CareerHighlightStat[] = [];
  for (const comp of career.currentSeasonHighlights ?? []) {
    out.push(...comp.stats);
  }
  return out;
}

function sumHighlightType(career: Player365Career, type: number): number | null {
  let found = false;
  let total = 0;
  for (const stat of flattenHighlights(career)) {
    if (stat.type === type) {
      found = true;
      total += parseStat(stat.value);
    }
  }
  return found ? total : null;
}

function findHighlightByName(
  career: Player365Career,
  predicates: ((name: string) => boolean)[],
): number | null {
  for (const stat of flattenHighlights(career)) {
    const name = `${stat.name} ${stat.shortName ?? ''}`.toLowerCase();
    if (predicates.some((p) => p(name))) return parseStat(stat.value);
  }
  return null;
}

function pickStat(
  career: Player365Career,
  type: number | null,
  predicates: ((name: string) => boolean)[],
): number | null {
  if (type != null) {
    const byType = sumHighlightType(career, type);
    if (byType != null) return byType;
  }
  return findHighlightByName(career, predicates);
}

export function careerCurrentSeason(career: Player365Career) {
  return (
    career.seasons.find((s) => s.seasonKey === career.currentSeasonKey) ?? career.seasons[0] ?? null
  );
}

export function careerSeasonSummary(
  career: Player365Career,
  seasonKey?: string | null,
): PlayerSeasonSummary | null {
  const current = careerCurrentSeason(career);
  const season = (seasonKey && career.seasons.find((s) => s.seasonKey === seasonKey)) || current;
  if (!season) return null;
  const isCurrent = season.seasonKey === current?.seasonKey;
  const sumComp = (key: 'yellowCards' | 'redCards') =>
    season.competitions.reduce((acc, c) => acc + (c[key] ?? 0), 0);
  const minutesFromComps = season.competitions.reduce<number | null>(
    (acc, c) => (c.minutes != null ? (acc ?? 0) + c.minutes : acc),
    null,
  );
  return {
    matches: season.appearances ?? null,
    goals: season.goals ?? null,
    assists: season.assists ?? null,
    minutes: season.minutes ?? minutesFromComps,
    shotsOnTarget: isCurrent ? sumHighlightType(career, SHOTS_ON_TARGET_TYPE) : null,
    chancesCreated: isCurrent ? sumHighlightType(career, CHANCES_CREATED_TYPE) : null,
    yellowCards: sumComp('yellowCards'),
    redCards: sumComp('redCards'),
  };
}

export function careerDetailedStats(
  career: Player365Career,
  seasonKey?: string | null,
): PlayerDetailedStats | null {
  const summary = careerSeasonSummary(career, seasonKey);
  if (!summary) return null;
  const current = careerCurrentSeason(career);
  const isCurrent = !seasonKey || seasonKey === current?.seasonKey;
  if (!isCurrent) {
    return {
      passAccuracy: null,
      shotsOnTarget: summary.shotsOnTarget,
      shots: null,
      yellowCards: summary.yellowCards,
      chancesCreated: summary.chancesCreated,
      dribbles: null,
    };
  }

  const passAccuracy = pickStat(career, PASS_ACCURACY_TYPE, [
    (n) => n.includes('pass') && (n.includes('%') || n.includes('accur') || n.includes('دقة')),
    (n) => n.includes('دقة التمرير') || n.includes('pass accuracy'),
  ]);
  const shots = pickStat(career, TOTAL_SHOTS_TYPE, [
    (n) => (n.includes('shot') || n.includes('تسديد')) && !n.includes('target') && !n.includes('مرمى'),
  ]);
  const dribbles = pickStat(career, DRIBBLES_TYPE, [
    (n) => n.includes('dribbl') || n.includes('مراوغ'),
  ]);

  return {
    passAccuracy,
    shotsOnTarget:
      summary.shotsOnTarget ??
      pickStat(career, SHOTS_ON_TARGET_TYPE, [
        (n) => n.includes('on target') || n.includes('على المرمى'),
      ]),
    shots,
    yellowCards: summary.yellowCards,
    chancesCreated:
      summary.chancesCreated ??
      pickStat(career, CHANCES_CREATED_TYPE, [
        (n) => n.includes('chance') || n.includes('فرص'),
      ]),
    dribbles,
  };
}

export function careerAverageRating(
  career: Player365Career,
  seasonKey?: string | null,
): number | null {
  const current = careerCurrentSeason(career);
  const season = (seasonKey && career.seasons.find((s) => s.seasonKey === seasonKey)) || current;
  if (season) {
    const rated = season.competitions.filter((c) => c.rating != null && Number.isFinite(c.rating));
    if (rated.length) {
      const weight = (c: (typeof rated)[0]) => Math.max(c.appearances ?? 1, 1);
      const totalW = rated.reduce((a, c) => a + weight(c), 0);
      const sum = rated.reduce((a, c) => a + (c.rating as number) * weight(c), 0);
      return totalW > 0 ? sum / totalW : null;
    }
  }
  const matches = (career.lastMatches ?? []).filter((m) => m.played && m.rating != null);
  if (!matches.length) return null;
  return matches.reduce((a, m) => a + (m.rating as number), 0) / matches.length;
}

function per90(value: number | null | undefined, minutes: number | null | undefined): number | null {
  if (value == null || minutes == null || minutes <= 0 || !Number.isFinite(value)) return null;
  return (value / minutes) * 90;
}

export function careerPer90(
  career: Player365Career,
  seasonKey?: string | null,
): PlayerPer90Stats | null {
  const summary = careerSeasonSummary(career, seasonKey);
  const detailed = careerDetailedStats(career, seasonKey);
  if (!summary?.minutes) return null;
  const minutes = summary.minutes;
  const keyPasses = pickStat(career, KEY_PASSES_TYPE, [
    (n) => n.includes('key pass') || (n.includes('تمرير') && n.includes('مفتاح')),
  ]);
  const xG = pickStat(career, XG_TYPE, [(n) => n.includes('xg') || n.includes('expected goal')]);

  const stats: PlayerPer90Stats = {
    goals: per90(summary.goals, minutes),
    assists: per90(summary.assists, minutes),
    shots: per90(detailed?.shots, minutes),
    keyPasses: per90(keyPasses, minutes),
    dribbles: per90(detailed?.dribbles, minutes),
    xG: per90(xG, minutes),
  };
  const hasAny = Object.values(stats).some((v) => v != null);
  return hasAny ? stats : null;
}

export function careerTransferRows(career: Player365Career): PlayerTransferRow[] {
  return (career.profile.transfers ?? []).map((tr, idx) => ({
    key: `${tr.competitorId ?? 'x'}-${tr.date ?? ''}-${idx}`,
    clubName: tr.competitorName || '—',
    clubLogo: tr.competitorLogo ?? null,
    date: tr.date ? tr.date.slice(0, 10) : null,
    price: tr.price ?? null,
    title: tr.transferTitle ?? null,
    active: !!tr.active,
  }));
}

/** 365 sends DOB as "dd/mm/yyyy"; other sources use ISO. */
export function ageFromDateOfBirth(dob: string | null | undefined): number | null {
  if (!dob) return null;
  let date: Date | null = null;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(dob.trim());
  if (dmy) {
    date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  } else {
    const parsed = Date.parse(dob);
    if (Number.isFinite(parsed)) date = new Date(parsed);
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const beforeBirthday =
    now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 10 && age <= 60 ? age : null;
}
