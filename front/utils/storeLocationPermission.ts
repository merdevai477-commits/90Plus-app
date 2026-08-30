import * as Location from 'expo-location';
import { Linking } from 'react-native';

export type StoreLocationPermission = 'granted' | 'denied' | 'undetermined';

export async function getStoreLocationPermission(): Promise<StoreLocationPermission> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function requestStoreLocationPermission(): Promise<StoreLocationPermission> {
  const current = await getStoreLocationPermission();
  if (current === 'granted') return 'granted';

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getCurrentStoreCoordinates(): Promise<{ lat: number; lng: number } | null> {
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
