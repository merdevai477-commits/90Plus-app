import type { Player365Career } from '../../services/apiFootball';
import type { PlayerSeasonSummary, PlayerTransferRow } from './types';

const SHOTS_ON_TARGET_TYPE = 35;
const CHANCES_CREATED_TYPE = 212;

function parseStat(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const n = Number.parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function sumHighlightType(career: Player365Career, type: number): number | null {
  let found = false;
  let total = 0;
  for (const comp of career.currentSeasonHighlights ?? []) {
    for (const stat of comp.stats) {
      if (stat.type === type) {
        found = true;
        total += parseStat(stat.value);
      }
    }
  }
  return found ? total : null;
}

export function careerCurrentSeason(career: Player365Career) {
  return (
    career.seasons.find((s) => s.seasonKey === career.currentSeasonKey) ?? career.seasons[0] ?? null
  );
}

export function careerSeasonSummary(career: Player365Career): PlayerSeasonSummary | null {
  const season = careerCurrentSeason(career);
  if (!season) return null;
  const sumComp = (key: 'yellowCards' | 'redCards') =>
    season.competitions.reduce((acc, c) => acc + (c[key] ?? 0), 0);
  return {
    matches: season.appearances ?? null,
    goals: season.goals ?? null,
    assists: season.assists ?? null,
    minutes: season.minutes ?? null,
    shotsOnTarget: sumHighlightType(career, SHOTS_ON_TARGET_TYPE),
    chancesCreated: sumHighlightType(career, CHANCES_CREATED_TYPE),
    yellowCards: sumComp('yellowCards'),
    redCards: sumComp('redCards'),
  };
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
