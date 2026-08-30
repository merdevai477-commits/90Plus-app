import { getGooglePlacesApiKey } from '../components/predictAndWin/googlePlaces';

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

type PlacesApiStatus = 'OK' | 'ZERO_RESULTS' | string;

async function placesJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Legacy Places Autocomplete — biased to Egypt for store addresses. */
export async function fetchPlaceSuggestions(
  input: string,
  language = 'ar',
): Promise<PlaceSuggestion[]> {
  const key = getGooglePlacesApiKey();
  const q = input.trim();
  if (!key || q.length < 2) return [];

  const params = new URLSearchParams({
    input: q,
    key,
    language,
    components: 'country:eg',
  });
  const data = await placesJson<{
    status: PlacesApiStatus;
    predictions?: Array<{ place_id: string; description: string }>;
  }>(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);

  if (!data || data.status !== 'OK') return [];
  return (data.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
  }));
}

export async function fetchPlaceFormattedAddress(
  placeId: string,
  language = 'ar',
): Promise<string | null> {
  const key = getGooglePlacesApiKey();
  if (!key || !placeId) return null;

  const params = new URLSearchParams({
    place_id: placeId,
    key,
    language,
    fields: 'formatted_address',
  });
  const data = await placesJson<{
    status: PlacesApiStatus;
    result?: { formatted_address?: string };
  }>(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);

  if (!data || data.status !== 'OK') return null;
  return data.result?.formatted_address?.trim() ?? null;
}
