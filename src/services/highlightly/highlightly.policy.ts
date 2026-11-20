import { teamNamesLooselyMatch } from '../../utils/team-name-match.util';

export const FINISHED_HIGHLIGHT_STATUSES = ['FT', 'AET', 'PEN'] as const;
export const HIGHLIGHT_TIMEZONE = 'Africa/Cairo';
export const KICKOFF_WINDOW_MS = 6 * 60 * 60 * 1000;
/** 48h after full time. Two hours covers a normal match after kickoff. */
export const HIGHLIGHT_WINDOW_MS = 50 * 60 * 60 * 1000;
export const MAX_REQUESTS_PER_TICK = 2;
export const MAX_DATES_PER_TICK = 2;
export const FREE_TICK_MS = 30 * 60 * 1000;
export const PAID_TICK_MS = 5 * 60 * 1000;
export const PAID_REMAINING_FLOOR = 1000;
export const HIGHLIGHT_PAGE_LIMIT = 40;
export const SUMMARY_CATEGORY = 'match-highlights';
export const GOAL_CATEGORY = 'goal-clip';

const BACKOFF_MS = [
  30 * 60 * 1000,
  60 * 60 * 1000,
  2 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

export type HighlightReadStatus = 'not_finished' | 'pending' | 'ready' | 'unavailable';
export type HighlightSyncStatus = 'pending' | 'ready' | 'unavailable';

export interface HighlightFixtureCandidate {
  fixtureId: number;
  homeTeamName: string;
  awayTeamName: string;
  matchDate: Date;
}

export interface FixtureLink {
  fixtureId: number | null;
  ambiguous: boolean;
  candidateIds: number[];
}

export interface StoredHighlightClip {
  highlightlyId: number;
  category: string;
  type: string;
  title: string;
  description: string | null;
  url: string;
  embedUrl: string | null;
  imgUrl: string | null;
  source: string | null;
}

export interface PublicHighlight {
  title: string;
  description: string | null;
  url: string;
  embedUrl: string | null;
  thumbnail: string | null;
  source: string | null;
  type: string;
  /** Owned CDN URL first, then the original external URL. */
  playbackUrls?: string[];
}

export interface SyncDateFixture {
  fixtureId: number;
  matchDate: Date;
  due: boolean;
  priority: boolean;
}

export function isFinishedHighlightStatus(status: string | null | undefined): boolean {
  return FINISHED_HIGHLIGHT_STATUSES.includes(
    status as (typeof FINISHED_HIGHLIGHT_STATUSES)[number],
  );
}

export function highlightDateKey(date: Date, timeZone = HIGHLIGHT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

export function highlightWindowEnds(matchDate: Date): Date {
  return new Date(matchDate.getTime() + HIGHLIGHT_WINDOW_MS);
}

export function linkHighlightToFixture(
  clip: { homeTeamName: string; awayTeamName: string; matchDate: Date },
  fixtures: HighlightFixtureCandidate[],
): FixtureLink {
  const hits: number[] = [];
  for (const fixture of fixtures) {
    const kickoffDelta = Math.abs(fixture.matchDate.getTime() - clip.matchDate.getTime());
    if (kickoffDelta > KICKOFF_WINDOW_MS) continue;
    const direct =
      teamNamesLooselyMatch(fixture.homeTeamName, clip.homeTeamName) &&
      teamNamesLooselyMatch(fixture.awayTeamName, clip.awayTeamName);
    const swapped =
      teamNamesLooselyMatch(fixture.homeTeamName, clip.awayTeamName) &&
      teamNamesLooselyMatch(fixture.awayTeamName, clip.homeTeamName);
    if (direct || swapped) hits.push(fixture.fixtureId);
  }
  const candidateIds = [...new Set(hits)];
  if (candidateIds.length === 1) {
    return { fixtureId: candidateIds[0], ambiguous: false, candidateIds };
  }
  if (candidateIds.length > 1) {
    return { fixtureId: null, ambiguous: true, candidateIds };
  }
  return { fixtureId: null, ambiguous: false, candidateIds };
}

function toPublic(clip: StoredHighlightClip): PublicHighlight {
  return {
    title: clip.title,
    description: clip.description,
    url: clip.url,
    embedUrl: clip.embedUrl,
    thumbnail: clip.imgUrl,
    source: clip.source,
    type: clip.type,
  };
}

function verifiedRank(type: string): number {
  return type.trim().toUpperCase() === 'VERIFIED' ? 1 : 0;
}

function summaryPlayRank(clip: StoredHighlightClip): number {
  const title = `${clip.title} ${clip.description ?? ''}`.toLowerCase();
  const file = /\.mp4(?:$|\?)|streamin\./i.test(clip.url) ? 0 : 20;
  const recap = /highlight|ملخص|resumen|all goals|match recap/.test(title) ? 0 : 8;
  const verified = verifiedRank(clip.type) === 1 ? 0 : 2;
  return file + recap + verified;
}

export function pickSummaries(clips: StoredHighlightClip[]): PublicHighlight[] {
  const summaries = clips.filter((clip) => clip.category === SUMMARY_CATEGORY && (clip.url || clip.embedUrl));
  summaries.sort((a, b) => {
    const rank = summaryPlayRank(a) - summaryPlayRank(b);
    if (rank !== 0) return rank;
    return a.highlightlyId - b.highlightlyId;
  });
  const seen = new Set<string>();
  const picked: PublicHighlight[] = [];
  for (const clip of summaries) {
    const key = (clip.embedUrl || clip.url).replace(/[?&#].*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(toPublic(clip));
  }
  return picked;
}

export function pickSummary(clips: StoredHighlightClip[]): PublicHighlight | null {
  return pickSummaries(clips)[0] ?? null;
}

export function pickGoals(clips: StoredHighlightClip[]): PublicHighlight[] {
  const seen = new Set<string>();
  const goals = clips
    .filter((clip) => clip.category === GOAL_CATEGORY && clip.url)
    .sort((a, b) => a.highlightlyId - b.highlightlyId);
  const picked: PublicHighlight[] = [];
  for (const goal of goals) {
    if (seen.has(goal.url)) continue;
    seen.add(goal.url);
    picked.push(toPublic(goal));
  }
  return picked;
}

export function planNextCheck(input: {
  foundSummary: boolean;
  matchDate: Date;
  attempts: number;
  now: Date;
}): { status: HighlightSyncStatus; nextCheckAt: Date; attempts: number } {
  if (input.foundSummary) {
    return {
      status: 'ready',
      nextCheckAt: new Date(input.now.getTime() + 365 * 24 * 60 * 60 * 1000),
      attempts: input.attempts,
    };
  }

  const attempts = input.attempts + 1;
  const expiresAt = highlightWindowEnds(input.matchDate).getTime();
  if (input.now.getTime() >= expiresAt) {
    return { status: 'unavailable', nextCheckAt: new Date(expiresAt), attempts };
  }

  const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
  const next = input.now.getTime() + delay;
  if (next >= expiresAt) {
    return { status: 'pending', nextCheckAt: new Date(expiresAt), attempts };
  }
  return { status: 'pending', nextCheckAt: new Date(next), attempts };
}

export function resolveReadStatus(input: {
  finished: boolean;
  hasUsefulClips: boolean;
  syncStatus: string | null;
  matchDate: Date | null;
  now: Date;
}): HighlightReadStatus {
  if (!input.finished) return 'not_finished';
  if (input.hasUsefulClips) return 'ready';
  if (input.syncStatus === 'unavailable') return 'unavailable';
  if (input.matchDate && input.now.getTime() >= highlightWindowEnds(input.matchDate).getTime()) {
    return 'unavailable';
  }
  return 'pending';
}

export function shouldPrioritizeHighlight(input: {
  status: HighlightReadStatus;
  nextCheckAt: Date | null;
  now: Date;
}): boolean {
  if (input.status !== 'pending') return false;
  return input.nextCheckAt == null || input.nextCheckAt.getTime() <= input.now.getTime();
}

export function canSpendHighlightRequest(input: {
  used: number;
  budget: number;
  upstreamRemaining: number | null;
  reserve: number;
  pausedUntilMs: number | null;
  nowMs: number;
}): boolean {
  if (input.pausedUntilMs != null && input.nowMs < input.pausedUntilMs) return false;
  if (input.used >= input.budget) return false;
  if (input.upstreamRemaining != null && input.upstreamRemaining < input.reserve) return false;
  return true;
}

export function isFastSyncTier(tier: string | null, upstreamRemaining: number | null): boolean {
  if (!tier || upstreamRemaining == null || upstreamRemaining <= PAID_REMAINING_FLOOR) return false;
  const normalized = tier.trim().toUpperCase();
  return normalized !== 'FREE' && normalized !== 'BASIC';
}

export function syncTickGapMs(tier: string | null, upstreamRemaining: number | null): number {
  return isFastSyncTier(tier, upstreamRemaining) ? PAID_TICK_MS : FREE_TICK_MS;
}

export function selectSyncDates(fixtures: SyncDateFixture[], limit = MAX_DATES_PER_TICK): string[] {
  const groups = new Map<string, { priority: boolean; dueCount: number; newest: number }>();
  for (const fixture of fixtures) {
    if (!fixture.due) continue;
    const key = highlightDateKey(fixture.matchDate);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        priority: fixture.priority,
        dueCount: 1,
        newest: fixture.matchDate.getTime(),
      });
      continue;
    }
    current.priority = current.priority || fixture.priority;
    current.dueCount += 1;
    current.newest = Math.max(current.newest, fixture.matchDate.getTime());
  }

  return [...groups.entries()]
    .sort((left, right) => {
      if (left[1].priority !== right[1].priority) return left[1].priority ? -1 : 1;
      if (left[1].dueCount !== right[1].dueCount) return right[1].dueCount - left[1].dueCount;
      return right[1].newest - left[1].newest;
    })
    .slice(0, limit)
    .map(([key]) => key);
}

export function isFixtureDue(
  state: { status: string; nextCheckAt: Date } | undefined,
  now: Date,
): boolean {
  if (!state) return true;
  if (state.status !== 'pending') return false;
  return state.nextCheckAt.getTime() <= now.getTime();
}
