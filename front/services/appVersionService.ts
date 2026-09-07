/**
 * App Version Service
 * للتحقق من إصدار التطبيق وإجبار التحديث
 */

import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform, Linking, Alert } from 'react-native';
import { getApiUrl } from '../config/api.config';
import { safeJsonParse } from '../utils/safeJsonParse';

const API_URL = getApiUrl();

export interface AppVersionInfo {
    currentVersion: string;
    minimumVersion: string;
    clientVersion: string;
    needsUpdate: boolean;
    forceUpdate: boolean;
    updateMessage: string | null;
    updateUrl: string;
    maintenance: boolean;
    maintenanceMessage?: string;
}

/**
 * Get current app version
 */
export function getCurrentAppVersion(): string {
    try {
        // Try to get version from app.json or package.json
        const version = Constants.expoConfig?.version || Application.nativeApplicationVersion || '1.0.0';
        return version;
    } catch (error) {
        console.warn('Failed to get app version:', error);
        return '1.0.0';
    }
}

/** Marketing version plus native build (iOS buildNumber / Android versionCode). */
export function getAppVersionLabel(): string {
    const version = getCurrentAppVersion();
    let build: string | null = null;
    try {
        const nativeBuild = Application.nativeBuildVersion;
        build = nativeBuild ? String(nativeBuild) : null;
    } catch {
        build = null;
    }
    if (build && build !== version) {
        return `${version} (${build})`;
    }
    return version;
}

/**
 * Check app version with server
 */
export async function checkAppVersion(): Promise<AppVersionInfo | null> {
    try {
        const currentVersion = getCurrentAppVersion();
        const platform = Platform.OS;

        // Abort after 6 seconds to prevent hanging fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(`${API_URL}/app/version?version=${encodeURIComponent(currentVersion)}&platform=${platform}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-app-version': currentVersion,
                'x-platform': platform,
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 503) {
            // Maintenance mode
            const data = await safeJsonParse<any>(response, { status: 'MAINTENANCE', maintenanceMessage: null });
            return {
                currentVersion: '0.0.0',
                minimumVersion: '0.0.0',
                clientVersion: currentVersion,
                needsUpdate: false,
                forceUpdate: false,
                updateMessage: null,
                updateUrl: '',
                maintenance: true,
                maintenanceMessage: data?.maintenanceMessage || 'التطبيق تحت الصيانة. يرجى المحاولة لاحقاً.',
            };
        }

        if (response.status === 426) {
            // Update required
            const data = await safeJsonParse<any>(response, { 
                currentVersion: '1.0.0', 
                minimumVersion: '1.0.0',
                forceUpdate: false,
                message: null,
                updateUrl: ''
            });
            return {
                currentVersion: data?.currentVersion || '1.0.0',
                minimumVersion: data?.minimumVersion || '1.0.0',
                clientVersion: currentVersion,
                needsUpdate: true,
                forceUpdate: data?.forceUpdate || false,
                updateMessage: data?.message || 'يجب تحديث التطبيق لاستمرار الاستخدام.',
                updateUrl: data?.updateUrl || '',
                maintenance: false,
            };
        }

        const data = await safeJsonParse<any>(response, { status: 'ERROR', data: null });
        
        if (data && data.status === 'SUCCESS' && data.data) {
            return data.data;
        }

        return null;
    } catch (error: any) {
        console.error('Error checking app version:', error);
        // Don't block app if version check fails
        return null;
    }
}

/**
 * Show update required dialog
 */
export function showUpdateDialog(versionInfo: AppVersionInfo) {
    const title = versionInfo.forceUpdate ? 'تحديث مطلوب' : 'تحديث متاح';
    const message = versionInfo.updateMessage || 'يجب تحديث التطبيق لاستمرار الاستخدام.';

    Alert.alert(
        title,
        message,
        [
            {
                text: 'تحديث الآن',
                onPress: () => {
                    if (versionInfo.updateUrl) {
                        Linking.openURL(versionInfo.updateUrl).catch(err => {
                            console.error('Failed to open update URL:', err);
                            Alert.alert('خطأ', 'فشل فتح رابط التحديث');
                        });
                    }
                },
            },
            ...(versionInfo.forceUpdate ? [] : [{
                text: 'لاحقاً',
                style: 'cancel' as const,
            }]),
        ],
        { cancelable: !versionInfo.forceUpdate }
    );
}

/**
 * Show maintenance mode dialog
 */
export function showMaintenanceDialog(versionInfo: AppVersionInfo) {
    Alert.alert(
        'التطبيق تحت الصيانة',
        versionInfo.maintenanceMessage || 'التطبيق تحت الصيانة. يرجى المحاولة لاحقاً.',
        [
            {
                text: 'حسناً',
                onPress: () => {
                    // Optionally exit app
                    if (Platform.OS !== 'web') {
                        // Application.exitApp() if needed
                    }
                },
            },
        ],
        { cancelable: false }
    );
}

