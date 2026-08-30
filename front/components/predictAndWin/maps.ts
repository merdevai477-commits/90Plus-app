import { Linking, Platform } from 'react-native';

import { getGooglePlacesApiKey, hasGooglePlacesApiKey } from '../../config/googlePlaces';

export { getGooglePlacesApiKey, hasGooglePlacesApiKey };

/** Opens Google Maps (or Apple Maps on iOS) with a location search query. */
export async function openGoogleMapsSearch(query: string): Promise<boolean> {
  const encoded = encodeURIComponent(query.trim());
  const url = Platform.select({
    ios: `https://maps.apple.com/?q=${encoded}`,
    android: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  })!;
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
