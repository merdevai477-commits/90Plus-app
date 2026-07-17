/**
 * One-shot Android (and all platforms) push registration forensic report.
 * Logs from app launch through getExpoPushTokenAsync / backend sync context.
 *
 * Enable lines in Metro / adb logcat:
 *   __DEV__  OR  EXPO_PUBLIC_PUSH_TRACE=1
 *
 * Filter:  adb logcat | grep "PUSH REPORT"
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { pushTrace, PUSH_TRACE_ENABLED } from '../utils/pushTrace';
import { loadNotifications, isPushRegistrationAvailable } from './pushTokenRegistration.service';
import { getApiEndpoint } from '../config/api.config';

export type PushRegistrationReport = {
    context: string;
    at: string;
    platform: string;
    isDevice: boolean;
    appOwnership: string;
    projectId: string | null;
    notificationsModuleLoaded: boolean;
    isPushRegistrationAvailable: boolean;
    permission: {
        status: string;
        granted: boolean;
        canAskAgain?: boolean;
        ios?: Record<string, unknown>;
        android?: Record<string, unknown>;
    } | null;
    expoPushToken: string | null;
    expoPushTokenError: string | null;
    tokenAttempted: boolean;
    localVsRemote: {
        localNotifications: string;
        remotePushRequires: string;
    };
    verdict: string;
};

function ownershipLabel(): string {
    const o = Constants.appOwnership;
    if (o === 'expo' || o === 'standalone' || o === 'guest') return o;
    return o ?? 'null';
}

function resolveProjectId(): string | null {
    const id =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    return id ?? '17b8b105-8756-4a9b-a2ff-b7a831eb946b';
}

function buildVerdict(report: Omit<PushRegistrationReport, 'verdict'>): string {
    if (!report.isDevice) {
        return 'SKIP: not a physical device (simulator/emulator may block Expo push token)';
    }
    if (report.appOwnership === 'expo') {
        return 'BLOCKED: Expo Go — remote push registration disabled; use EAS dev/production build';
    }
    if (!report.notificationsModuleLoaded) {
        return 'BLOCKED: expo-notifications module not loaded';
    }
    if (!report.permission) {
        return 'BLOCKED: could not read getPermissionsAsync()';
    }
    if (report.permission.status === 'denied') {
        return 'BLOCKED: OS permission denied — enable in Settings; remote token will not register';
    }
    if (report.permission.status === 'undetermined') {
        return 'WAITING: OS permission undetermined — grant via modal or reel upload prompt';
    }
    if (report.permission.status !== 'granted') {
        return `BLOCKED: unexpected permission status "${report.permission.status}"`;
    }
    if (report.expoPushTokenError) {
        return `FAIL: getExpoPushTokenAsync threw — likely FCM/Expo credentials or projectId (${report.expoPushTokenError})`;
    }
    if (!report.expoPushToken) {
        return 'FAIL: permission granted but no ExponentPushToken — inspect expoPushTokenError and native FCM setup';
    }
    return 'OK: ExponentPushToken obtained — if DB empty, check backend sync / auth / POST /push-token';
}

/**
 * Collect and log a single structured report (permission + token attempt).
 */
export async function logPushRegistrationReport(context: string): Promise<PushRegistrationReport> {
    const projectId = resolveProjectId();
    const Notifications = loadNotifications();
    const notificationsModuleLoaded = !!Notifications;

    let permission: PushRegistrationReport['permission'] = null;
    let expoPushToken: string | null = null;
    let expoPushTokenError: string | null = null;
    let tokenAttempted = false;

    if (Notifications) {
        try {
            const perm = await Notifications.getPermissionsAsync();
            permission = {
                status: perm.status,
                granted: perm.status === 'granted',
                canAskAgain: perm.canAskAgain,
                ios: perm.ios ? { ...perm.ios } : undefined,
                android: perm.android ? { ...perm.android } : undefined,
            };
        } catch (e: unknown) {
            expoPushTokenError =
                e instanceof Error ? e.message : `getPermissionsAsync failed: ${String(e)}`;
        }
    }

    const canTryToken =
        notificationsModuleLoaded &&
        Device.isDevice &&
        Constants.appOwnership !== 'expo' &&
        permission?.status === 'granted';

    if (canTryToken && Notifications) {
        tokenAttempted = true;
        pushTrace('[PUSH TRACE] report: before getExpoPushTokenAsync');
        try {
            const data = await Notifications.getExpoPushTokenAsync({ projectId: projectId ?? undefined });
            expoPushToken = data.data;
            pushTrace(`[PUSH TRACE] report: token=${expoPushToken}`);
        } catch (e: unknown) {
            expoPushTokenError = e instanceof Error ? e.message : String(e);
            pushTrace(`[PUSH TRACE] report: token=error:${expoPushTokenError}`);
        }
    } else if (permission && permission.status !== 'granted') {
        pushTrace(
            `[PUSH TRACE] report: skipped getExpoPushTokenAsync (permission=${permission.status})`,
        );
    }

    const partial = {
        context,
        at: new Date().toISOString(),
        platform: Platform.OS,
        isDevice: Device.isDevice,
        appOwnership: ownershipLabel(),
        projectId,
        notificationsModuleLoaded,
        isPushRegistrationAvailable: isPushRegistrationAvailable(),
        permission,
        expoPushToken,
        expoPushTokenError,
        tokenAttempted,
        localVsRemote: {
            localNotifications:
                'scheduleNotificationAsync / reel upload progress — needs OS permission only',
            remotePushRequires:
                'granted permission + physical device + EAS build + FCM (Android) + getExpoPushTokenAsync + POST /push-token',
        },
    };

    const report: PushRegistrationReport = {
        ...partial,
        verdict: buildVerdict(partial),
    };

    const payload = JSON.stringify(report, null, 2);
    if (PUSH_TRACE_ENABLED) {
        console.log('[PUSH REPORT] ────────────────────────────────────────');
        console.log(`[PUSH REPORT] context=${context}`);
        console.log(payload);
        console.log(`[PUSH REPORT] verdict=${report.verdict}`);
        console.log('[PUSH REPORT] ────────────────────────────────────────');
    }

    // Always ship to backend so store Android builds are diagnosable without Metro.
    fetch(getApiEndpoint('debug/push-log'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'push_registration_report', ...report }),
    }).catch(() => {});

    return report;
}
