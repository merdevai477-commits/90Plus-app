/**
 * Native RTL/LTR via React Native I18nManager.
 * Changing direction requires a one-time app reload.
 */

import { DevSettings, I18nManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from './types';

export const RTL_RELOAD_FLAG_KEY = '@rtl_reload_requested_v1';

export function shouldLanguageBeRTL(language: Language): boolean {
  return language === 'ar';
}

/**
 * Apply native layout direction. Returns true when a reload is required
 * for the change to take effect.
 */
export function applyNativeLayoutDirection(shouldBeRTL: boolean): boolean {
  I18nManager.allowRTL(true);

  if (I18nManager.isRTL === shouldBeRTL) {
    return false;
  }

  I18nManager.forceRTL(shouldBeRTL);
  return true;
}

export async function reloadAppForLayoutDirection(): Promise<void> {
  try {
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
    return;
  } catch {
    // Expo Go / dev client
  }

  if (Platform.OS !== 'web' && typeof DevSettings?.reload === 'function') {
    DevSettings.reload();
  }
}

export async function clearRtlReloadFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RTL_RELOAD_FLAG_KEY);
  } catch {
    // non-fatal
  }
}

export async function markRtlReloadPending(): Promise<void> {
  try {
    await AsyncStorage.setItem(RTL_RELOAD_FLAG_KEY, '1');
  } catch {
    // non-fatal
  }
}

export async function wasRtlReloadPending(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(RTL_RELOAD_FLAG_KEY)) === '1';
  } catch {
    return false;
  }
}
