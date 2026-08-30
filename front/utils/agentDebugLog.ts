import Constants from 'expo-constants';
import { Platform } from 'react-native';

const INGEST_PATH = '/ingest/ce439b36-426f-4b5e-a32c-0044dc26eb8b';
const SESSION_ID = 'bb8055';

function resolveIngestBaseUrl(): string {
  if (Platform.OS === 'web') return 'http://127.0.0.1:7793';

  const candidates: unknown[] = [
    Constants.expoConfig?.hostUri,
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost,
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2
      ?.extra?.expoGo?.debuggerHost,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length === 0) continue;
    const host = candidate.replace(/^\w+:\/\//, '').split('/')[0].split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:7793`;
    }
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:7793' : 'http://127.0.0.1:7793';
}

export function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'pre-fix',
): void {
  fetch(`${resolveIngestBaseUrl()}${INGEST_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      location,
      message,
      data,
      timestamp: Date.now(),
      hypothesisId,
      runId,
    }),
  }).catch(() => {});
}
