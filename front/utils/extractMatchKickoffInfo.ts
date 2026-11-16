export type MatchKickoffInfo = {
  stadiumName: string | null;
  city: string | null;
  capacity: number | null;
  attendance: number | null;
  stadiumImage: string | null;
  referee: string | null;
  /** Nationality / country when the feed embeds it (e.g. "C. Turpin, France"). */
  refereeCountry: string | null;
  staff: string | null;
  broadcast: string | null;
};

type VenueLike = {
  name?: string | null;
  city?: string | null;
  capacity?: number | null;
  attendance?: number | null;
  image?: string | null;
} | null | undefined;

type FixtureLike = {
  fixture?: {
    referee?: string | null;
    venue?: VenueLike;
  };
  _tvNetworks?: Array<string | { name?: string | null }>;
  _officials?: string[];
} | null | undefined;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

/** Upstream feeds sometimes send names HTML-escaped (e.g. "Stade Michel d&apos;Ornano"). */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

function clean(value?: string | null): string | null {
  const next = decodeEntities(value ?? '').trim();
  return next || null;
}

function positiveInt(value?: number | null): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function tvNames(raw?: Array<string | { name?: string | null }> | null): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const row of raw) {
    const name = clean(typeof row === 'string' ? row : row?.name);
    if (name) names.push(name);
  }
  return names;
}

export function extractMatchKickoffInfo(opts: {
  fixture?: FixtureLike;
  venue?: VenueLike;
}): MatchKickoffInfo {
  const fixtureVenue = opts.fixture?.fixture?.venue;
  const venue = opts.venue ?? null;
  const officials = (opts.fixture?._officials ?? []).map((name) => clean(name)).filter((name): name is string => !!name);
  const rawReferee = officials[0] ?? clean(opts.fixture?.fixture?.referee);
  const { name: referee, country: refereeCountry } = splitReferee(rawReferee);
  const staff = officials.slice(1).join(' · ') || null;
  const broadcast = tvNames(opts.fixture?._tvNetworks).join(' · ') || null;

  return {
    stadiumName: clean(venue?.name) ?? clean(fixtureVenue?.name),
    city: clean(venue?.city) ?? clean(fixtureVenue?.city),
    capacity: positiveInt(venue?.capacity) ?? positiveInt(fixtureVenue?.capacity),
    attendance: positiveInt(venue?.attendance) ?? positiveInt(fixtureVenue?.attendance),
    stadiumImage: clean(venue?.image) ?? clean(fixtureVenue?.image),
    referee,
    refereeCountry,
    staff,
    broadcast,
  };
}

/** API-Football often ships "Name, Country" in the referee field. */
function splitReferee(raw: string | null): { name: string | null; country: string | null } {
  if (!raw) return { name: null, country: null };
  const comma = raw.lastIndexOf(',');
  if (comma <= 0 || comma >= raw.length - 1) return { name: raw, country: null };
  const name = raw.slice(0, comma).trim();
  const country = raw.slice(comma + 1).trim();
  if (!name || !country || country.length > 40) return { name: raw, country: null };
  return { name, country };
}

export function hasMatchKickoffFacts(info: MatchKickoffInfo): boolean {
  return Boolean(
    info.stadiumName ||
      info.city ||
      info.capacity ||
      info.attendance ||
      info.referee ||
      info.staff ||
      info.broadcast,
  );
}
