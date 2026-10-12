import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { ExtensionStorage } from '@bacons/apple-targets';

/** Must match `ios.entitlements` in app.json and targets/widget (Swift `WidgetShared.appGroup`). */
export const WIDGET_APP_GROUP = 'group.com.mhmdsh1892.ninetyplusapp';
/** Must match Swift `WidgetShared.configKey` and Kotlin `WidgetStore`. */
const CONFIG_KEY = 'widget.config';

export interface WidgetLabels {
  live: string;
  upcoming: string;
  finished: string;
  halftime: string;
  postponed: string;
  topPlayers: string;
  momentum: string;
  myTeams: string;
  followTeams: string;
  vs: string;
  today: string;
  tomorrow: string;
  lineup: string;
  stats: string;
  events: string;
}

export interface WidgetConfig {
  teamIds: number[];
  favoriteIds: number[];
  apiBase: string;
  language: 'ar' | 'en';
  labels: WidgetLabels;
  updatedAt: number;
}

type AndroidWidgetBridge = {
  setConfig(json: string): void;
  reload(): void;
};

type IosLiveActivityBridge = {
  areLiveActivitiesEnabled(): Promise<boolean>;
  activeMatchActivities(): Promise<number[]>;
  startMatchActivity(json: string): Promise<boolean>;
  endMatchActivity(fixtureId: number): Promise<void>;
  refreshLiveActivityRegistration(): Promise<void>;
};

/** Must match Swift `MatchActivityAttributes` and the backend's live-activity.service.ts. */
export interface MatchActivityAttributes {
  fixtureId: number;
  homeName: string;
  awayName: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  language: string;
}

export interface MatchActivityState {
  homeScore: number;
  awayScore: number;
  status: 'live' | 'ht' | 'ft' | 'upcoming';
  minute: number | null;
  clockStart: number | null;
}

const androidBridge =
  Platform.OS === 'android' ? requireOptionalNativeModule<AndroidWidgetBridge>('WidgetBridge') : null;

const iosBridge =
  Platform.OS === 'ios' ? requireOptionalNativeModule<IosLiveActivityBridge>('WidgetBridge') : null;

const iosStorage = Platform.OS === 'ios' ? new ExtensionStorage(WIDGET_APP_GROUP) : null;

export function setWidgetConfig(config: WidgetConfig): void {
  const json = JSON.stringify(config);
  iosStorage?.set(CONFIG_KEY, json);
  androidBridge?.setConfig(json);
}

export function reloadWidgets(): void {
  if (Platform.OS === 'ios') ExtensionStorage.reloadWidget();
  androidBridge?.reload();
}

export const liveActivities = {
  isSupported: iosBridge != null,
  areEnabled: () => iosBridge?.areLiveActivitiesEnabled() ?? Promise.resolve(false),
  activeFixtureIds: () => iosBridge?.activeMatchActivities() ?? Promise.resolve([] as number[]),
  start: (attributes: MatchActivityAttributes, state: MatchActivityState) =>
    iosBridge?.startMatchActivity(JSON.stringify({ attributes, state })) ?? Promise.resolve(false),
  end: (fixtureId: number) => iosBridge?.endMatchActivity(fixtureId) ?? Promise.resolve(),
  /** Re-sends the push-to-start token so the server knows the current followed teams. */
  refreshRegistration: () => iosBridge?.refreshLiveActivityRegistration() ?? Promise.resolve(),
};
