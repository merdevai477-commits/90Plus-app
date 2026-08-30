import { Linking, Platform } from 'react-native';

export {
  getGooglePlacesApiKey,
  getGoogleMapsJsApiKey,
  hasGooglePlacesApiKey,
  hasGoogleMapsJsApiKey,
} from '../../config/googlePlaces';

/** Try each URL until one opens — `canOpenURL` is unreliable for https/geo on Android. */
async function openFirst(urls: string[]): Promise<boolean> {
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      /* try next scheme */
    }
  }
  return false;
}

/** Opens Google Maps (or Apple Maps on iOS) with a location search query. */
export async function openGoogleMapsSearch(query: string): Promise<boolean> {
  const q = query.trim();
  const encoded = encodeURIComponent(q);

  if (Platform.OS === 'android') {
    const urls = q
      ? [
          `geo:0,0?q=${encoded}`,
          `https://www.google.com/maps/search/?api=1&query=${encoded}`,
        ]
      : ['geo:0,0', 'https://www.google.com/maps'];
    return openFirst(urls);
  }

  if (Platform.OS === 'ios') {
    const urls = q
      ? [`comgooglemaps://?q=${encoded}`, `https://maps.apple.com/?q=${encoded}`]
      : ['comgooglemaps://', 'https://maps.apple.com/'];
    return openFirst(urls);
  }

  const urls = q
    ? [`https://www.google.com/maps/search/?api=1&query=${encoded}`]
    : ['https://www.google.com/maps'];
  return openFirst(urls);
}
