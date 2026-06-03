import { Match } from '../components/Matches/matchCardUtils';
import { Image } from 'expo-image';
import { getCountryFlagUri } from './countryFlagUri';

/** Prefetch team/league logos + fast country flags after matches load. */
export function prefetchMatchAssets(matches: Match[]): void {
  if (matches.length === 0) return;

  const urls = new Set<string>();
  for (const m of matches) {
    if (m.homeTeam?.logo) urls.add(m.homeTeam.logo);
    if (m.awayTeam?.logo) urls.add(m.awayTeam.logo);
    if (m.league?.logo) urls.add(m.league.logo);
    const flagUri = getCountryFlagUri(m.league?.country ?? '', m.league?.countryFlag);
    if (flagUri) urls.add(flagUri);
  }

  const list = Array.from(urls).slice(0, 180);
  if (list.length > 0) {
    Image.prefetch(list, 'memory-disk').catch(() => {});
  }
}
