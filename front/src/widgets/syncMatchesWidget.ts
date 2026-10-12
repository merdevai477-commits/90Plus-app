import Constants from 'expo-constants';

import { reloadWidgets, setWidgetConfig, type WidgetLabels } from '../../modules/widget-bridge';
import { getApiUrl } from '../../utils/getApiUrl';
import { logger } from '../../utils/logger';
import { syncLiveActivities } from './liveActivities';

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
    followTeams: 'Follow teams on 90Plus to see their matches here.',
    vs: 'vs',
    today: 'Today',
    tomorrow: 'Tomorrow',
    lineup: 'Lineup',
    stats: 'Stats',
    events: 'Key events',
    goal: 'GOAL!',
    info: 'Match info',
    form: 'Form & head to head',
    referee: 'Referee',
    points: 'pts',
    draws: 'Draws',
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
    followTeams: 'تابع فرق في 90Plus عشان تشوف ماتشاتها هنا',
    vs: 'vs',
    today: 'اليوم',
    tomorrow: 'غدًا',
    lineup: 'التشكيلة',
    stats: 'الإحصائيات',
    events: 'أحداث المباراة',
    goal: 'هدف!',
    info: 'معلومات المباراة',
    form: 'المستوى والمواجهات',
    referee: 'الحكم',
    points: 'نقطة',
    draws: 'تعادل',
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
export function syncMatchesWidget(
  teamIds: number[],
  language: WidgetLanguage,
  force = false,
  favoriteIds: number[] = [],
): void {
  const signature = `${language}|${teamIds.join(',')}|${favoriteIds.join(',')}`;
  const changed = signature !== lastSignature;
  if (!changed && !force) return;
  const apiBase = widgetApiBase();
  try {
    if (changed) {
      setWidgetConfig({
        teamIds,
        favoriteIds,
        apiBase,
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
  void syncLiveActivities(apiBase, teamIds, language, favoriteIds);
}
