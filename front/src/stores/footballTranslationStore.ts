import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '../i18n/types';
import { fetchFootballNameTranslations } from '../../services/footballTranslationService';

interface FootballTranslationState {
  /** en source → ar display */
  cache: Record<string, string>;
  revision: number;
  inflight: boolean;
  prefetch: (texts: string[], language: Language) => Promise<void>;
  getCached: (source: string) => string | null;
}

const pendingKeys = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const flushQueue = new Set<string>();

function normalizeKey(text: string): string {
  return text.trim();
}

export const useFootballTranslationStore = create<FootballTranslationState>()(
  persist(
    (set, get) => ({
      cache: {},
      revision: 0,
      inflight: false,

      getCached: (source: string) => {
        const key = normalizeKey(source);
        if (!key) return null;
        return get().cache[key] ?? null;
      },

      prefetch: async (texts: string[], language: Language) => {
        if (language !== 'ar') return;

        const unique = [...new Set(texts.map(normalizeKey).filter(Boolean))];
        const missing = unique.filter((t) => !get().cache[t] && !pendingKeys.has(t));
        if (missing.length === 0) return;

        for (const t of missing) pendingKeys.add(t);

        set({ inflight: true });
        try {
          const CHUNK = 150;
          for (let i = 0; i < missing.length; i += CHUNK) {
            const chunk = missing.slice(i, i + CHUNK);
            const translations = await fetchFootballNameTranslations(chunk, language);
            if (Object.keys(translations).length === 0) continue;

            set((state) => {
              const next = { ...state.cache, ...translations };
              return { cache: next, revision: state.revision + 1 };
            });
          }
        } finally {
          for (const t of missing) pendingKeys.delete(t);
          set({ inflight: false });
        }
      },
    }),
    {
      name: 'football-name-translations-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ cache: state.cache }),
    },
  ),
);

/** Sync read for render helpers — no hook subscription. */
export function getCachedFootballTranslation(source: string | null | undefined): string | null {
  const key = (source ?? '').trim();
  if (!key) return null;
  return useFootballTranslationStore.getState().getCached(key);
}

/** Debounced batch enqueue for on-demand single names. */
export function queueFootballTranslation(source: string, language: Language): void {
  if (language !== 'ar') return;
  const key = normalizeKey(source);
  if (!key) return;
  if (useFootballTranslationStore.getState().cache[key]) return;

  flushQueue.add(key);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    const batch = [...flushQueue];
    flushQueue.clear();
    flushTimer = null;
    if (batch.length > 0) {
      void useFootballTranslationStore.getState().prefetch(batch, language);
    }
  }, 120);
}

export function prefetchFootballTranslations(texts: string[], language: Language): void {
  if (language !== 'ar' || texts.length === 0) return;
  void useFootballTranslationStore.getState().prefetch(texts, language);
}
