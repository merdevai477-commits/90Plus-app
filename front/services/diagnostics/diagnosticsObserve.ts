import { readObserveStoredEntries } from '../../utils/expoObserveSafe';
import { diagFlags } from './diagnosticsState';
import { recordDiagEvent } from './diagnosticsRecorder';

const SAFE_ID = /^[\w\-:.]+$/;
const SAFE_NAME = /^[\w\-:.]+$/;

/**
 * Expo Observe keeps owning general performance. A session only reads entries
 * the SDK already stored. iOS may return none; that is recorded as count 0.
 */
export async function recordObserveSummary(): Promise<void> {
  if (!diagFlags.observe) return;
  let entries: Awaited<ReturnType<typeof readObserveStoredEntries>> = [];
  try {
    entries = await readObserveStoredEntries();
  } catch {
    entries = [];
  }
  const ids: string[] = [];
  const metrics: Record<string, number> = {};
  for (const entry of entries) {
    if (ids.length < 5 && entry.sessionId && SAFE_ID.test(entry.sessionId) && !ids.includes(entry.sessionId)) {
      ids.push(entry.sessionId.slice(0, 64));
    }
    if (entry.name && SAFE_NAME.test(entry.name) && typeof entry.value === 'number' && Number.isFinite(entry.value)) {
      if (Object.keys(metrics).length < 48) metrics[entry.name.slice(0, 48)] = entry.value;
    }
  }
  recordDiagEvent('observe_entries_summary', {
    data: {
      count: entries.length,
      ...(ids.length ? { observeSessionIds: ids } : {}),
      ...(Object.keys(metrics).length ? { metrics } : {}),
    },
  });
}
