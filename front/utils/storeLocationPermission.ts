import { Linking } from 'react-native';

export type StoreLocationPermission = 'granted' | 'denied' | 'undetermined';

type LocationModule = typeof import('expo-location');

/** Lazy — avoids crashing when dev client was built before expo-location was added. */
let locationModule: LocationModule | null | undefined;

async function getLocationModule(): Promise<LocationModule | null> {
  if (locationModule !== undefined) return locationModule;
  try {
    const mod = await import('expo-location');
    await mod.getForegroundPermissionsAsync();
    locationModule = mod;
    return mod;
  } catch {
    locationModule = null;
    return null;
  }
}

export async function isNativeLocationAvailable(): Promise<boolean> {
  return (await getLocationModule()) !== null;
}

export async function getStoreLocationPermission(): Promise<StoreLocationPermission> {
  const Location = await getLocationModule();
  if (!Location) return 'undetermined';

  const { status } = await Location.getForegroundPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function requestStoreLocationPermission(): Promise<StoreLocationPermission> {
  const Location = await getLocationModule();
  if (!Location) return 'undetermined';

  const current = await getStoreLocationPermission();
  if (current === 'granted') return 'granted';

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getCurrentStoreCoordinates(): Promise<{ lat: number; lng: number } | null> {
  const Location = await getLocationModule();
  if (!Location) return null;

  const permission = await requestStoreLocationPermission();
  if (permission !== 'granted') return null;

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export function openAppSettings(): void {
  Linking.openSettings().catch(() => undefined);
}
