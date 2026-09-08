import { getApiUrl } from '../config/api.config';

export async function fetchStadiumImageByName(
  name: string,
  country?: string | null,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const params = new URLSearchParams({ name: trimmed });
  const countryName = (country ?? '').trim();
  if (countryName) params.set('country', countryName);
  const base = getApiUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/football/stadium-image?${params.toString()}`);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    response?: { imageUrl?: unknown; isPlaceholder?: unknown };
  };
  if (json?.response?.isPlaceholder === true) return null;
  const imageUrl = json?.response?.imageUrl;
  return typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null;
}

export function isUnverifiedStadiumCdnUrl(url?: string | null): boolean {
  const value = (url ?? '').trim();
  if (!value) return false;
  return /imagecache\.365scores\.com\/image\/upload\/.*\/Venues\//i.test(value);
}
