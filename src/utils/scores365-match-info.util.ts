/** Match preview fields from a 365 `/web/game/` payload (venue, officials, TV). */

export type Scores365Official = { name?: string | null };
export type Scores365TvNetwork = { name?: string | null; countryId?: number | null };
export type Scores365VenueInfo = {
  id?: number | null;
  name?: string | null;
  shortName?: string | null;
  capacity?: number | null;
  attendance?: number | null;
  googlePlaceId?: string | null;
};

export function cityFrom365VenueName(name?: string | null): string | null {
  const raw = (name ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/\(([^)]+)\)\s*$/);
  const city = match?.[1]?.trim();
  return city || null;
}

export function scores365VenueImageUrl(venueId?: number | null): string | null {
  if (venueId == null || !Number.isFinite(venueId) || venueId <= 0) return null;
  return `https://imagecache.365scores.com/image/upload/f_jpg,w_800,h_450,c_fill,q_auto:eco/v1/Venues/${venueId}`;
}

export function map365OfficialNames(officials?: Scores365Official[] | null): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of officials ?? []) {
    const name = (row?.name ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function pick365BroadcastNames(
  networks?: Scores365TvNetwork[] | null,
  preferredCountryId = 131,
  limit = 3,
): string[] {
  const rows = (networks ?? []).filter((row) => (row?.name ?? '').trim());
  const preferred = rows.filter((row) => row.countryId === preferredCountryId);
  const source = preferred.length > 0 ? preferred : rows;
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of source) {
    const name = (row.name ?? '').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= limit) break;
  }
  return names;
}

export function map365VenueFields(venue?: Scores365VenueInfo | null): {
  id: number | null;
  name: string | null;
  city: string | null;
  capacity: number | null;
  attendance: number | null;
  image: string | null;
} {
  const id = venue?.id != null && Number.isFinite(venue.id) ? venue.id : null;
  const name = (venue?.name ?? '').trim() || null;
  const capacity =
    venue?.capacity != null && Number.isFinite(venue.capacity) && venue.capacity > 0
      ? Math.floor(venue.capacity)
      : null;
  const attendance =
    venue?.attendance != null && Number.isFinite(venue.attendance) && venue.attendance > 0
      ? Math.floor(venue.attendance)
      : null;
  return {
    id,
    name,
    city: cityFrom365VenueName(name),
    capacity,
    attendance,
    image: scores365VenueImageUrl(id),
  };
}
