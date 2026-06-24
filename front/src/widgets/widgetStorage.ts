import AsyncStorage from '@react-native-async-storage/async-storage';
import { WIDGET_MATCHES_STORAGE_KEY } from './constants';
import type { MatchesWidgetPayload } from './types';
import { EMPTY_WIDGET_PAYLOAD } from './types';

export async function loadCachedWidgetPayload(): Promise<MatchesWidgetPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_MATCHES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MatchesWidgetPayload;
    if (!parsed || !Array.isArray(parsed.matches)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCachedWidgetPayload(payload: MatchesWidgetPayload): Promise<void> {
  await AsyncStorage.setItem(WIDGET_MATCHES_STORAGE_KEY, JSON.stringify(payload));
}

export async function loadWidgetPayloadWithFallback(): Promise<MatchesWidgetPayload> {
  const cached = await loadCachedWidgetPayload();
  return cached ?? { ...EMPTY_WIDGET_PAYLOAD, updatedAt: Date.now() };
}
