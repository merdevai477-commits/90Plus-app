import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useAuth } from '@clerk/clerk-expo';
import {
    getExpoPushTokenIfPermitted,
    loadNotifications,
    isPushRegistrationAvailable,
    syncExpoPushToken,
} from '../../services/pushTokenRegistration.service';
import { logPushRegistrationReport } from '../../services/pushRegistrationReport.service';
import { getApiUrl } from '../../config/api.config';

type RowProps = { label: string; value: string };

function Row({ label, value }: RowProps) {
    return (
        <View style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value} selectable>
                {value}
            </Text>
        </View>
    );
}

export function PushDiagnosticsScreen() {
    const { getToken, isSignedIn } = useAuth();
    const [permStatus, setPermStatus] = useState<string>('loading...');
    const [runResult, setRunResult] = useState<string>('(tap Run Diagnostics)');
    const [dbToken, setDbToken] = useState<string>('(sign in + run diagnostics)');
    const [tokenMatch, setTokenMatch] = useState<string>('—');
    const [fullReport, setFullReport] = useState<string>('(tap Run Full Report)');
    const [running, setRunning] = useState(false);

    const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId ??
        'undefined';

    useEffect(() => {
        (async () => {
            const Notifications = loadNotifications();
            if (!Notifications) {
                setPermStatus('module unavailable (Expo Go / web)');
                return;
            }
            const perm = await Notifications.getPermissionsAsync();
            setPermStatus(perm.status);
        })();
    }, []);

    const runFullReport = useCallback(async () => {
        setRunning(true);
        try {
            const report = await logPushRegistrationReport('push-diagnostics-screen');
            setFullReport(JSON.stringify(report, null, 2));
            if (report.permission?.status) {
                setPermStatus(report.permission.status);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setFullReport(`error: ${msg}`);
        } finally {
            setRunning(false);
        }
    }, []);

    const runDiagnostics = useCallback(async () => {
        setRunning(true);
        setRunResult('Running...');
        try {
            const token = await getExpoPushTokenIfPermitted();
            if (token) {
                setRunResult(`Device token\n${token}`);

                if (isSignedIn) {
                    const authToken = await getToken();
                    let stored: string | null = null;
                    if (authToken) {
                        try {
                            const res = await fetch(`${getApiUrl()}/matches/push-token/status`, {
                                headers: { Authorization: `Bearer ${authToken}` },
                            });
                            const json = await res.json();
                            const data = json?.data;
                            const prefix = data?.tokenPrefix as string | null | undefined;
                            const hasToken = !!data?.hasToken;
                            stored = prefix ?? (hasToken ? '(has token, no prefix)' : null);
                            setDbToken(
                                hasToken
                                    ? `${prefix ?? '(prefix missing)'}\nconsent=${String(data?.consent)}`
                                    : '(null in DB)',
                            );
                            const prefixBase = prefix?.replace(/\.\.\.$/, '') ?? '';
                            setTokenMatch(
                                !hasToken
                                    ? 'DB empty — run sync or grant permission while signed in'
                                    : prefixBase && token.startsWith(prefixBase)
                                      ? 'MATCH — device token matches DB prefix'
                                      : 'MISMATCH — sync may be broken',
                            );
                        } catch (e: unknown) {
                            const msg = e instanceof Error ? e.message : String(e);
                            setDbToken(`fetch failed: ${msg}`);
                            setTokenMatch('unknown');
                        }
                    }

                    const synced = await syncExpoPushToken(getToken);
                    setRunResult(
                        (prev) =>
                            `${prev}\n\nBackend sync: ${synced ? 'success' : 'failed'}`,
                    );
                } else {
                    setDbToken('(requires sign-in)');
                    setTokenMatch('—');
                    setRunResult((prev) => `${prev}\n\nBackend sync: skipped (not signed in)`);
                }
            } else {
                setRunResult('null — see Metro [PUSH TRACE] logs for EXIT reason');
                setDbToken('—');
                setTokenMatch('—');
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setRunResult(`error: ${msg}`);
        } finally {
            setRunning(false);
        }
    }, [getToken, isSignedIn]);

    return (
        <>
            <Stack.Screen options={{ title: 'Push Diagnostics', headerShown: true }} />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Text style={styles.title}>Push Diagnostics (dev)</Text>
                <Text style={styles.hint}>
                    Local reel upload notifications ≠ remote push. See docs/PUSH_ANDROID_DEVICE_REPORT.md
                </Text>
                <Text style={styles.hint}>
                    Logs: [PUSH REPORT] and [PUSH TRACE] in Metro or adb logcat (EXPO_PUBLIC_PUSH_TRACE=1 on store builds).
                </Text>

                <Row label="Device.isDevice" value={String(Device.isDevice)} />
                <Row label="Platform.OS" value={Platform.OS} />
                <Row
                    label="Constants.appOwnership"
                    value={String(Constants.appOwnership ?? 'null')}
                />
                <Row label="EAS projectId" value={String(projectId)} />
                <Row
                    label="isPushRegistrationAvailable()"
                    value={String(isPushRegistrationAvailable())}
                />
                <Row label="Notification permission" value={permStatus} />
                <Row label="Signed in" value={String(isSignedIn)} />

                <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={runFullReport}
                    disabled={running}
                >
                    <Text style={styles.buttonText}>Run Full Report</Text>
                </TouchableOpacity>

                <Text style={styles.section}>Full report (permission + getExpoPushTokenAsync)</Text>
                <Text style={styles.mono} selectable>
                    {fullReport}
                </Text>

                <TouchableOpacity
                    style={styles.button}
                    onPress={runDiagnostics}
                    disabled={running}
                >
                    {running ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Run Diagnostics + DB sync</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.section}>Device token (getExpoPushTokenIfPermitted)</Text>
                <Text style={styles.mono} selectable>
                    {runResult}
                </Text>

                <Text style={styles.section}>DB token (GET /matches/push-token/status)</Text>
                <Text style={styles.mono} selectable>
                    {dbToken}
                </Text>
                <Row label="Device vs DB" value={tokenMatch} />

                <Text style={styles.hint}>
                    Phase 6 E2E: after a real EAS build registers a token, run{'\n'}
                    npx tsx scripts/audit-push-tokens.ts --send-test --clerk-user-id YOUR_ID
                </Text>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0a0a' },
    content: { padding: 16, paddingBottom: 48 },
    title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
    hint: { color: '#888', fontSize: 13, marginBottom: 16 },
    row: { marginBottom: 12 },
    label: { color: '#9ca3af', fontSize: 12, marginBottom: 4 },
    value: { color: '#e5e7eb', fontSize: 14 },
    button: {
        backgroundColor: '#7c3aed',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginVertical: 12,
    },
    buttonSecondary: { backgroundColor: '#374151' },
    buttonText: { color: '#fff', fontWeight: '600' },
    section: { color: '#a78bfa', fontWeight: '600', marginTop: 8 },
    mono: {
        color: '#d1d5db',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        backgroundColor: '#111',
        padding: 10,
        borderRadius: 8,
        marginTop: 6,
    },
});
