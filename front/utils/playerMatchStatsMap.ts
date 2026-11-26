/**
 * Map 365Scores match-report `stats[]` into UI categories.
 * Separates data mapping from presentation; never fabricates missing values.
 */

import type { Language } from '../src/i18n/types';
import { getLocalizedStatType } from './i18nHelpers';

export type MatchStatSectionId =
  | 'attack'
  | 'passing'
  | 'dribbling'
  | 'defense'
  | 'physical'
  | 'goalkeeper'
  | 'other';

export type MatchStatKey =
  | 'rating'
  | 'goals'
  | 'assists'
  | 'minutes'
  | 'xg'
  | 'shots'
  | 'shotsOnTarget'
  | 'xgot'
  | 'offsides'
  | 'bigChances'
  | 'bigChancesMissed'
  | 'passes'
  | 'accuratePasses'
  | 'passAccuracy'
  | 'keyPasses'
  | 'chancesCreated'
  | 'accurateCrosses'
  | 'accurateLongBalls'
  | 'successfulDribbles'
  | 'totalDribbles'
  | 'possessionLost'
  | 'touches'
  | 'touchesOppBox'
  | 'tackles'
  | 'interceptions'
  | 'ballRecoveries'
  | 'groundDuelsWon'
  | 'aerialDuelsWon'
  | 'fouls'
  | 'clearances'
  | 'distance'
  | 'sprintDistance'
  | 'topSpeed'
  | 'sprints'
  | 'saves'
  | 'savePercentage'
  | 'goalsConceded'
  | 'cleanSheets';

export type MatchStatItem = {
  key: MatchStatKey | string;
  label: string;
  /** Original provider display string (preserves units / ratios). */
  display: string;
  /** Parsed leading number when available; null for pure text. */
  numeric: number | null;
  section: MatchStatSectionId;
  isTop: boolean;
};

export type MatchStatsDashboardModel = {
  rating: number | null;
  overview: {
    goals: MatchStatItem | null;
    assists: MatchStatItem | null;
    minutes: MatchStatItem | null;
  };
  keyStats: MatchStatItem[];
  sections: Array<{
    id: MatchStatSectionId;
    items: MatchStatItem[];
  }>;
  /** Flat leftover rows that did not map into a known key. */
  uncategorized: MatchStatItem[];
  totalRaw: number;
};

type StatDef = {
  key: MatchStatKey;
  section: MatchStatSectionId;
  types?: number[];
  names: RegExp[];
};

/** Stable 365 type ids where known in this codebase + common name patterns. */
const STAT_DEFS: StatDef[] = [
  { key: 'rating', section: 'other', types: [0], names: [/\brating\b/i, /تقييم/] },
  { key: 'goals', section: 'attack', types: [1], names: [/\bgoals?\b/i, /^أهداف$/, /^هدف$/] },
  { key: 'assists', section: 'attack', types: [2, 17], names: [/\bassists?\b/i, /صناع/] },
  { key: 'minutes', section: 'other', types: [30], names: [/\bminutes?\b/i, /دقائق/, /دقيقة/] },
  { key: 'xg', section: 'attack', types: [76], names: [/\bxg\b/i, /expected\s*goals?/i, /أهداف\s*متوقعة(?!\s*على)/i] },
  { key: 'shots', section: 'attack', types: [3], names: [/total\s*shots?/i, /\bshots?\b(?!\s*on)/i, /إجمالي\s*التسديدات/, /^تسديدات$/] },
  {
    key: 'shotsOnTarget',
    section: 'attack',
    types: [4, 35],
    names: [/shots?\s*on\s*(goal|target)/i, /تسديدات\s*على\s*المرمى/],
  },
  {
    key: 'xgot',
    section: 'attack',
    names: [/\bxgot\b/i, /expected\s*goals?\s*on\s*target/i, /أهداف\s*متوقعة\s*على\s*المرمى/],
  },
  { key: 'offsides', section: 'attack', types: [9], names: [/\boffsides?\b/i, /تسلل/] },
  { key: 'bigChances', section: 'attack', names: [/big\s*chances?(?!\s*miss)/i, /فرص\s*كبيرة(?!\s*ضائعة)/] },
  {
    key: 'bigChancesMissed',
    section: 'attack',
    names: [/big\s*chances?\s*miss/i, /فرص\s*كبيرة\s*ضائعة/],
  },
  { key: 'passes', section: 'passing', types: [19], names: [/\bpasses?\b(?!\s*acc)/i, /تمريرات/] },
  {
    key: 'accuratePasses',
    section: 'passing',
    names: [/accurate\s*passes?/i, /passes?\s*accurate/i, /تمريرات\s*دقيقة/],
  },
  {
    key: 'passAccuracy',
    section: 'passing',
    names: [/pass(es)?\s*accura/i, /دقة\s*التمرير/],
  },
  { key: 'keyPasses', section: 'passing', types: [20], names: [/key\s*passes?/i, /تمريرات\s*حاسمة/] },
  {
    key: 'chancesCreated',
    section: 'passing',
    types: [212],
    names: [/chances?\s*created/i, /فرص\s*مصنوعة/],
  },
  {
    key: 'accurateCrosses',
    section: 'passing',
    names: [/accurate\s*cross/i, /عرضيات\s*دقيقة/, /تمريرات\s*عرضية/],
  },
  {
    key: 'accurateLongBalls',
    section: 'passing',
    names: [/accurate\s*long/i, /كرات\s*طويلة/],
  },
  {
    key: 'successfulDribbles',
    section: 'dribbling',
    types: [13],
    names: [/successful\s*dribbles?/i, /dribbles?\s*won/i, /مراوغات\s*ناجحة/],
  },
  {
    key: 'totalDribbles',
    section: 'dribbling',
    names: [/total\s*dribbles?/i, /\bdribbles?\b/i, /مراوغات/],
  },
  {
    key: 'possessionLost',
    section: 'dribbling',
    names: [/possession\s*lost/i, /فقدان\s*الاستحواذ/, /كرات\s*مفقودة/],
  },
  { key: 'touches', section: 'dribbling', names: [/\btouches?\b(?!\s*in)/i, /لمسات(?!\s*في)/] },
  {
    key: 'touchesOppBox',
    section: 'dribbling',
    names: [/touches?\s*in\s*(opp|opposition|enemy)?\s*box/i, /لمسات\s*في\s*منطقة/],
  },
  { key: 'tackles', section: 'defense', names: [/\btackles?\b/i, /تدخلات/] },
  { key: 'interceptions', section: 'defense', names: [/\binterceptions?\b/i, /قطعات/, /اعتراضات/] },
  {
    key: 'ballRecoveries',
    section: 'defense',
    names: [/ball\s*recover/i, /استخلاص/, /استرداد/],
  },
  {
    key: 'groundDuelsWon',
    section: 'defense',
    names: [/ground\s*duels?/i, /مواجهات\s*أرضية/],
  },
  {
    key: 'aerialDuelsWon',
    section: 'defense',
    names: [/aerial\s*duels?/i, /مواجهات\s*هوائية/],
  },
  { key: 'fouls', section: 'defense', types: [42], names: [/\bfouls?\b/i, /أخطاء/] },
  { key: 'clearances', section: 'defense', names: [/\bclearances?\b/i, /تشتيت/] },
  {
    key: 'distance',
    section: 'physical',
    names: [/distance\s*covered/i, /المسافة/, /مسافة\s*مقطوعة/],
  },
  {
    key: 'sprintDistance',
    section: 'physical',
    names: [/sprint\s*distance/i, /مسافة\s*العدو/],
  },
  { key: 'topSpeed', section: 'physical', names: [/top\s*speed/i, /أقصى\s*سرعة/] },
  { key: 'sprints', section: 'physical', names: [/\bsprints?\b/i, /عدوات/] },
  { key: 'saves', section: 'goalkeeper', types: [23], names: [/\bsaves?\b/i, /تصديات/] },
  {
    key: 'savePercentage',
    section: 'goalkeeper',
    names: [/save\s*%|save\s*percentage/i, /نسبة\s*التصدي/],
  },
  {
    key: 'goalsConceded',
    section: 'goalkeeper',
    names: [/goals?\s*conceded/i, /أهداف\s*مستقبلة/],
  },
  {
    key: 'cleanSheets',
    section: 'goalkeeper',
    names: [/clean\s*sheets?/i, /شباك\s*نظيفة/],
  },
];

const KEY_ATTACK_ORDER: MatchStatKey[] = [
  'xg',
  'shots',
  'shotsOnTarget',
  'xgot',
  'offsides',
  'bigChances',
  'bigChancesMissed',
];

const SECTION_ORDER_BY_ROLE: Record<string, MatchStatSectionId[]> = {
  GK: ['goalkeeper', 'passing', 'defense', 'physical', 'attack', 'dribbling', 'other'],
  DEF: ['defense', 'passing', 'physical', 'attack', 'dribbling', 'goalkeeper', 'other'],
  MID: ['passing', 'dribbling', 'defense', 'attack', 'physical', 'goalkeeper', 'other'],
  WING: ['dribbling', 'attack', 'passing', 'defense', 'physical', 'goalkeeper', 'other'],
  ATT: ['attack', 'dribbling', 'passing', 'defense', 'physical', 'goalkeeper', 'other'],
};

function parseNumeric(value: string): number | null {
  const m = value.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** True when the provider actually sent a value (including legitimate 0). */
export function isPresentStatValue(raw: unknown): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s || s === '—' || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
    return false;
  }
  return true;
}

function rawStatFields(raw: unknown): {
  type: number | null;
  name: string;
  value: string;
  isTop: boolean;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const type =
    typeof o.type === 'number' ? o.type : typeof o.id === 'number' ? (o.id as number) : null;
  const name = [
    typeof o.name === 'string' ? o.name : '',
    typeof o.shortName === 'string' ? o.shortName : '',
    typeof o.typeName === 'string' ? o.typeName : '',
  ]
    .join(' ')
    .trim();
  const valueRaw = o.value ?? o.val ?? o.statValue;
  if (!isPresentStatValue(valueRaw)) return null;
  return {
    type,
    name,
    value: String(valueRaw).trim(),
    isTop: o.isTop === true,
  };
}

function matchDef(type: number | null, name: string): StatDef | null {
  if (type != null) {
    const byType = STAT_DEFS.find((d) => d.types?.includes(type));
    if (byType) return byType;
  }
  const hay = name.toLowerCase();
  for (const def of STAT_DEFS) {
    if (def.names.some((re) => re.test(hay) || re.test(name))) return def;
  }
  return null;
}

export type PlayerRoleBucket = 'GK' | 'DEF' | 'MID' | 'WING' | 'ATT' | 'UNK';

export function resolvePlayerRoleBucket(position: string | null | undefined): PlayerRoleBucket {
  const p = (position ?? '').toLowerCase();
  if (!p) return 'UNK';
  if (/goal|حارس|gk\b/.test(p)) return 'GK';
  if (/wing|جناح|winger|lw|rw/.test(p)) return 'WING';
  if (/def|back|ظهير|مدافع|cb|lb|rb/.test(p)) return 'DEF';
  if (/mid|وسط|cm|dm|am|cdm|cam/.test(p)) return 'MID';
  if (/att|forward|strik|مهاجم|cf|st|fw/.test(p)) return 'ATT';
  return 'UNK';
}

function sortKeysForRole(keys: MatchStatKey[], role: PlayerRoleBucket): MatchStatKey[] {
  const priority: MatchStatKey[] =
    role === 'ATT'
      ? ['goals', 'xg', 'shots', 'shotsOnTarget', 'xgot', 'assists', 'bigChances']
      : role === 'WING'
        ? ['successfulDribbles', 'assists', 'keyPasses', 'chancesCreated', 'shots', 'xg']
        : role === 'MID'
          ? ['passAccuracy', 'keyPasses', 'ballRecoveries', 'interceptions', 'passes', 'tackles']
          : role === 'DEF'
            ? ['tackles', 'interceptions', 'clearances', 'aerialDuelsWon', 'ballRecoveries', 'fouls']
            : role === 'GK'
              ? ['saves', 'savePercentage', 'goalsConceded', 'cleanSheets', 'passes']
              : KEY_ATTACK_ORDER;

  return [...keys].sort((a, b) => {
    const ia = priority.indexOf(a);
    const ib = priority.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/**
 * Build the match-stats dashboard model from a 365 report `stats` array.
 */
export function buildMatchStatsDashboard(
  stats: unknown[] | null | undefined,
  language: Language,
  position?: string | null,
): MatchStatsDashboardModel {
  const role = resolvePlayerRoleBucket(position);
  const byKey = new Map<MatchStatKey | string, MatchStatItem>();
  const uncategorized: MatchStatItem[] = [];
  let totalRaw = 0;

  for (const raw of stats ?? []) {
    const fields = rawStatFields(raw);
    if (!fields) continue;
    totalRaw += 1;
    const def = matchDef(fields.type, fields.name);
    const labelSource = fields.name || (fields.type != null ? `#${fields.type}` : 'Stat');
    const label = getLocalizedStatType(labelSource, language) || labelSource;
    const item: MatchStatItem = {
      key: def?.key ?? `raw-${totalRaw}-${label}`,
      label,
      display: fields.value,
      numeric: parseNumeric(fields.value),
      section: def?.section ?? 'other',
      isTop: fields.isTop,
    };

    if (def) {
      // Prefer first hit; keep isTop if either row flagged it.
      const prev = byKey.get(def.key);
      if (!prev) byKey.set(def.key, item);
      else if (!prev.isTop && item.isTop) byKey.set(def.key, { ...prev, isTop: true });
    } else {
      uncategorized.push({ ...item, section: 'other' });
    }
  }

  const ratingItem = byKey.get('rating') ?? null;
  const rating =
    ratingItem && ratingItem.numeric != null && Number.isFinite(ratingItem.numeric)
      ? ratingItem.numeric
      : null;

  const overview = {
    goals: byKey.get('goals') ?? null,
    assists: byKey.get('assists') ?? null,
    minutes: byKey.get('minutes') ?? null,
  };

  const keyKeys = sortKeysForRole(
    KEY_ATTACK_ORDER.filter((k) => byKey.has(k)),
    role,
  );
  // For non-attackers, still show available key attacking metrics but after role picks.
  const keyStats = keyKeys.map((k) => byKey.get(k)!).filter(Boolean);

  const sectionOrder =
    SECTION_ORDER_BY_ROLE[role] ??
    (['attack', 'passing', 'dribbling', 'defense', 'physical', 'goalkeeper', 'other'] as MatchStatSectionId[]);

  const usedInKey = new Set(keyKeys);
  const sections = sectionOrder
    .map((id) => {
      const items = [...byKey.values()].filter(
        (s) =>
          s.section === id &&
          s.key !== 'rating' &&
          s.key !== 'goals' &&
          s.key !== 'assists' &&
          s.key !== 'minutes' &&
          !usedInKey.has(s.key as MatchStatKey),
      );
      const orderedKeys = sortKeysForRole(
        items.map((i) => i.key as MatchStatKey),
        role,
      );
      const ordered = orderedKeys
        .map((k) => items.find((i) => i.key === k))
        .filter((x): x is MatchStatItem => !!x);
      const leftovers = items.filter((i) => !ordered.includes(i));
      return { id, items: [...ordered, ...leftovers] };
    })
    .filter((s) => s.items.length > 0);

  return {
    rating,
    overview,
    keyStats,
    sections,
    uncategorized,
    totalRaw,
  };
}
