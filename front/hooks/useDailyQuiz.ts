/**
 * useDailyQuiz — AsyncStorage-backed daily quiz with image prefetch.
 */

import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { getClerkBearerToken } from '../utils/clerkAuthToken';
import {
  dailyQuizQueryKey,
  dailyQuizStorageKey,
  todayQuizDateKey,
} from '../utils/quizDateKey';
import { AuthService } from '../src/services/authService';
import {
  QuizApiService,
  type QuizApiLanguage,
  type QuizDailyPayload,
} from '../services/quizApi.service';
const DATE_ROLLOVER_MS = 30_000;

function isPackPreparingError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message === 'PACK_GENERATING' ||
    err.message === 'API_ERROR_503' ||
    err.message === 'SERVER_WARMING'
  );
}

export async function readCachedDailyQuiz(
  lang: QuizApiLanguage,
  dateKey = todayQuizDateKey(),
): Promise<QuizDailyPayload | undefined> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(dailyQuizStorageKey(lang, dateKey));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as QuizDailyPayload;
    if (!parsed?.questions?.length) return undefined;
    if (parsed.packDate && parsed.packDate !== dateKey) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function cacheDailyQuiz(
  lang: QuizApiLanguage,
  data: QuizDailyPayload,
): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const dateKey = data.packDate || todayQuizDateKey();
    await AsyncStorage.setItem(dailyQuizStorageKey(lang, dateKey), JSON.stringify(data));
  } catch {
    // ignore cache write failures
  }
}

export function prefetchQuizImages(
  questions: QuizDailyPayload['questions'],
  fromIndex = 0,
): void {
  questions
    .slice(fromIndex, fromIndex + 3)
    .map((q) => q.imageUrl?.trim())
    .filter((uri): uri is string => Boolean(uri))
    .forEach((uri) => {
      void Image.prefetch(uri);
    });
}

type GetTokenFn = () => Promise<string | null>;

async function fetchDailyWithAuthRetry(
  getToken: GetTokenFn,
  lang: QuizApiLanguage,
  token: string,
): Promise<QuizDailyPayload> {
  try {
    return await QuizApiService.fetchDaily(token, lang);
  } catch (err) {
    if (!(err instanceof Error)) throw err;

    if (err.message === 'AUTH_REQUIRED') {
      const freshToken = await getClerkBearerToken(getToken, {
        retries: 5,
        baseDelayMs: 400,
      });
      if (!freshToken) throw err;
      await AuthService.syncUserWithBackend(freshToken, { getToken });
      return QuizApiService.fetchDaily(freshToken, lang);
    }

    if (err.message === 'USER_NOT_FOUND') {
      await AuthService.syncUserWithBackend(token, { getToken });
      return QuizApiService.fetchDaily(token, lang);
    }

    throw err;
  }
}

async function fetchLiveDaily(
  getToken: GetTokenFn,
  lang: QuizApiLanguage,
  expectedDateKey: string,
): Promise<QuizDailyPayload> {
  const token = await getClerkBearerToken(getToken);
  if (!token) throw new Error('AUTH_REQUIRED');

  try {
    await AuthService.syncUserWithBackend(token, { getToken });
  } catch {
    // Cold start / transient sync failure — quiz fetch retries auth below.
  }

  const data = await fetchDailyWithAuthRetry(getToken, lang, token);

  if (!data?.questions?.length) throw new Error('EMPTY_PACK');
  if (data.packDate && data.packDate !== expectedDateKey) {
    throw new Error('STALE_PACK');
  }
  await cacheDailyQuiz(lang, data);
  prefetchQuizImages(data.questions, data.currentIndex ?? 0);
  return data;
}

async function fetchAndCacheDaily(
  getToken: GetTokenFn,
  lang: QuizApiLanguage,
  expectedDateKey: string,
): Promise<QuizDailyPayload> {
  /*
   * No canned-pack fallback. A failure here surfaces to the query, which shows
   * the screen's existing error/retry state — the same rule
   * `useQuestionModeSession` applies to the other six modes. Serving authored
   * questions about invented players/clubs/stats is worse than showing a retry,
   * and it silently mixes fake football content into a real-data experience.
   */
  return fetchLiveDaily(getToken, lang, expectedDateKey);
}

export { dailyQuizQueryKey } from '../utils/quizDateKey';

export function useDailyQuiz(lang: QuizApiLanguage) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [dateKey, setDateKey] = useState(() => todayQuizDateKey());
  const [cachedData, setCachedData] = useState<QuizDailyPayload | undefined>();

  useEffect(() => {
    const bumpDateIfNeeded = () => {
      const next = todayQuizDateKey();
      setDateKey((prev) => (prev !== next ? next : prev));
    };

    const interval = setInterval(bumpDateIfNeeded, DATE_ROLLOVER_MS);
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') bumpDateIfNeeded();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readCachedDailyQuiz(lang, dateKey).then((data) => {
      if (!cancelled) setCachedData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [lang, dateKey]);

  const query = useQuery({
    queryKey: dailyQuizQueryKey(lang, dateKey),
    queryFn: () => fetchAndCacheDaily(getToken, lang, dateKey),
    enabled: Boolean(lang) && isLoaded === true && isSignedIn === true,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // Every pack is a real server pack now, so refetching is always safe —
    // progress lives on the server and comes back with it.
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Poll every 5s while the backend prepares the pack, but stop after ~2 min
    // so the UI can surface a retry state instead of spinning forever.
    refetchInterval: (q) =>
      isPackPreparingError(q.state.error) && q.state.errorUpdateCount < 24 ? 5000 : false,
    placeholderData:
      cachedData?.packDate === dateKey && cachedData.questions?.length
        ? cachedData
        : undefined,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message === 'AUTH_REQUIRED') return false;
      if (err instanceof Error && err.message === 'RATE_LIMIT') return false;
      if (isPackPreparingError(err)) return false;
      if (err instanceof Error && err.message === 'REQUEST_TIMEOUT') return failureCount < 2;
      if (err instanceof Error && err.message === 'STALE_PACK') return failureCount < 1;
      return failureCount < 1;
    },
    retryDelay: (attempt) => Math.min(1000 * (attempt + 1), 4000),
  });

  return { ...query, dateKey };
}

export async function prefetchDailyQuiz(
  queryClient: QueryClient,
  getToken: () => Promise<string | null>,
  lang: QuizApiLanguage,
): Promise<void> {
  const dateKey = todayQuizDateKey();
  const cached = await readCachedDailyQuiz(lang, dateKey);
  if (cached) {
    queryClient.setQueryData(dailyQuizQueryKey(lang, dateKey), cached);
    prefetchQuizImages(cached.questions, cached.currentIndex ?? 0);
  }

  const token = await getClerkBearerToken(getToken);
  if (!token) return;

  const existing = queryClient.getQueryData<QuizDailyPayload>(
    dailyQuizQueryKey(lang, dateKey),
  );
  if (existing?.questions?.length) return;

  try {
    await queryClient.prefetchQuery({
      queryKey: dailyQuizQueryKey(lang, dateKey),
      queryFn: () => fetchAndCacheDaily(getToken, lang, dateKey),
      staleTime: 5 * 60 * 1000,
    });
  } catch {
    // PACK_GENERATING / timeout — useDailyQuiz will poll when user opens quiz tab.
  }
}
