import Constants from 'expo-constants';

import { reloadWidgets, setWidgetConfig, type WidgetLabels } from '../../modules/widget-bridge';
import { getApiUrl } from '../../utils/getApiUrl';
import { logger } from '../../utils/logger';

type WidgetLanguage = 'ar' | 'en';

const LABELS: Record<WidgetLanguage, WidgetLabels> = {
  en: {
    live: 'Live',
    upcoming: 'Upcoming',
    finished: 'FT',
    halftime: 'HT',
    postponed: 'Postponed',
    topPlayers: 'Top rated',
    momentum: 'Match momentum',
    myTeams: 'My teams',
    followTeams: 'Follow teams in 90PLUS to see their matches here',
    vs: 'vs',
    today: 'Today',
    tomorrow: 'Tomorrow',
  },
  ar: {
    live: 'مباشر',
    upcoming: 'قادمة',
    finished: 'انتهت',
    halftime: 'استراحة',
    postponed: 'مؤجلة',
    topPlayers: 'الأعلى تقييمًا',
    momentum: 'زخم المباراة',
    myTeams: 'فرقي',
    followTeams: 'تابع فرقك في 90PLUS لتظهر مبارياتها هنا',
    vs: 'vs',
    today: 'اليوم',
    tomorrow: 'غدًا',
  },
};

/** Widgets fetch outside the app, so a LAN dev API (plain http) would never be reachable. */
function widgetApiBase(): string {
  const api = getApiUrl().replace(/\/+$/, '');
  if (api.startsWith('https://')) return api;
  return String(Constants.expoConfig?.extra?.apiUrl ?? 'https://90plus.pro/api').replace(/\/+$/, '');
}

let lastSignature = '';

/**
 * Hands the followed team list to the native widgets and asks them to refresh.
 * `force` re-fetches even when the team list is unchanged (e.g. app returning to foreground).
 */
export function syncMatchesWidget(teamIds: number[], language: WidgetLanguage, force = false): void {
  const signature = `${language}|${teamIds.join(',')}`;
  const changed = signature !== lastSignature;
  if (!changed && !force) return;
  try {
    if (changed) {
      setWidgetConfig({
        teamIds,
        apiBase: widgetApiBase(),
        language,
        labels: LABELS[language],
        updatedAt: Date.now(),
      });
    }
    reloadWidgets();
    lastSignature = signature;
  } catch (error) {
    logger.warn('[widgets] sync failed:', error);
  }
}
