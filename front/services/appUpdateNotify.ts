/**
 * Local notification when a store update is available.
 * Opens the store when the user taps the notification (via APP_UPDATE type).
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const NOTIFIED_VERSION_KEY = '@90plus_update_notified_version';
const CHANNEL_ID = 'app-updates';

const isExpoGo = Constants.appOwnership === 'expo';

type NotificationsModule = typeof import('expo-notifications');

let cachedModule: NotificationsModule | null | undefined;

function getNotificationsModule(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  if (isExpoGo) return null;
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('expo-notifications') as NotificationsModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

async function ensureChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'App updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250],
    enableVibrate: true,
    sound: 'default',
  });
}

export async function notifyAppUpdateAvailable(options: {
  latestVersion: string;
  title: string;
  body: string;
  updateUrl: string;
}): Promise<void> {
  const { latestVersion, title, body, updateUrl } = options;
  if (!latestVersion) return;

  try {
    const last = await AsyncStorage.getItem(NOTIFIED_VERSION_KEY);
    if (last === latestVersion) return;
  } catch {
    /* continue */
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) {
    try {
      await AsyncStorage.setItem(NOTIFIED_VERSION_KEY, latestVersion);
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    await ensureChannel(Notifications);
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'APP_UPDATE',
          updateUrl,
          latestVersion,
        },
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null,
    });
    await AsyncStorage.setItem(NOTIFIED_VERSION_KEY, latestVersion);
  } catch (err) {
    logger.warn('[AppUpdate] Failed to schedule update notification:', err);
  }
}

export async function markUpdatePromptDismissed(latestVersion: string): Promise<void> {
  if (!latestVersion) return;
  try {
    await AsyncStorage.setItem(`@90plus_update_soft_dismissed_${latestVersion}`, '1');
  } catch {
    /* ignore */
  }
}

export async function wasUpdatePromptDismissed(latestVersion: string): Promise<boolean> {
  if (!latestVersion) return false;
  try {
    const v = await AsyncStorage.getItem(`@90plus_update_soft_dismissed_${latestVersion}`);
    return v === '1';
  } catch {
    return false;
  }
}
