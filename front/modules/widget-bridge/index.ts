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
}

export interface WidgetConfig {
  teamIds: number[];
  apiBase: string;
  language: 'ar' | 'en';
  labels: WidgetLabels;
  updatedAt: number;
}

type AndroidWidgetBridge = {
  setConfig(json: string): void;
  reload(): void;
};

const androidBridge =
  Platform.OS === 'android' ? requireOptionalNativeModule<AndroidWidgetBridge>('WidgetBridge') : null;

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
