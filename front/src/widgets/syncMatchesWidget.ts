import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { fetchWidgetMatchesPayload } from './fetchWidgetMatches';
import { WIDGET_NAME } from './constants';
import type { MatchesWidgetPayload } from './types';
import { saveCachedWidgetPayload } from './widgetStorage';
import { logger } from '../../utils/logger';

let syncInFlight: Promise<MatchesWidgetPayload | null> | null = null;

async function pushIosWidget(payload: MatchesWidgetPayload): Promise<void> {
  if (Platform.OS !== 'ios') return;

  if (!requireOptionalNativeModule('ExpoWidgets')) {
    logger.warn(
      '[widgets] ExpoWidgets native module missing — run: npx expo prebuild --clean --platform ios && npm run ios',
    );
    return;
  }

  try {
    const { default: MatchesWidget } = await import('../../widgets/MatchesWidget');
    if (typeof MatchesWidget?.updateSnapshot !== 'function') {
      logger.warn('[widgets] iOS widget module missing updateSnapshot');
      return;
    }
    MatchesWidget.updateSnapshot(payload);
  } catch (error) {
    logger.warn('[widgets] iOS update failed:', error);
  }
}

/** Push cached payload on startup so the widget gallery preview is not blank. */
export async function primeIosWidgetFromCache(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (!requireOptionalNativeModule('ExpoWidgets')) return;
  try {
    const { loadWidgetPayloadWithFallback } = await import('./widgetStorage');
    const payload = await loadWidgetPayloadWithFallback();
    await pushIosWidget(payload);
  } catch {
    // non-fatal
  }
}

async function pushAndroidWidget(payload: MatchesWidgetPayload): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { renderMatchesAndroidWidget } = await import('../../widgets/MatchesWidget.android');
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => renderMatchesAndroidWidget(payload),
      widgetNotFound: () => {},
    });
  } catch (error) {
    logger.warn('[widgets] Android update failed (native rebuild required):', error);
  }
}

/** Refresh widget data from API, persist locally, and push to iOS/Android widgets. */
export async function syncMatchesWidget(): Promise<MatchesWidgetPayload | null> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    try {
      const payload = await fetchWidgetMatchesPayload();
      await saveCachedWidgetPayload(payload);
      await Promise.all([pushIosWidget(payload), pushAndroidWidget(payload)]);
      return payload;
    } catch (error) {
      logger.warn('[widgets] sync failed:', error);
      return null;
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

export function scheduleMatchesWidgetSync(delayMs = 1500): void {
  setTimeout(() => {
    void syncMatchesWidget();
  }, delayMs);
}
