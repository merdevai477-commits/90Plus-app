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

async function persistDailyQuiz(
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

async function fetchAndCacheDaily(
  getToken: () => Promise<string | null>,
  lang: QuizApiLanguage,
  expectedDateKey: string,
): Promise<QuizDailyPayload> {
  const token = await getClerkBearerToken(getToken);
  if (!token) throw new Error('AUTH_REQUIRED');

  await AuthService.syncUserWithBackend(token).catch(() => null);

  let data: QuizDailyPayload;
  try {
    data = await QuizApiService.fetchDaily(token, lang);
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      await AuthService.syncUserWithBackend(token);
      data = await QuizApiService.fetchDaily(token, lang);
    } else {
      throw err;
    }
  }

  if (!data?.questions?.length) throw new Error('EMPTY_PACK');
  if (data.packDate && data.packDate !== expectedDateKey) {
    throw new Error('STALE_PACK');
  }
  await persistDailyQuiz(lang, data);
  prefetchQuizImages(data.questions, data.currentIndex ?? 0);
  return data;
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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData:
      cachedData?.packDate === dateKey && cachedData.questions?.length
        ? cachedData
        : undefined,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message === 'AUTH_REQUIRED') return false;
      if (err instanceof Error && err.message === 'RATE_LIMIT') return false;
      if (err instanceof Error && err.message === 'STALE_PACK') return failureCount < 1;
      return failureCount < 2;
    },
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

  await queryClient.prefetchQuery({
    queryKey: dailyQuizQueryKey(lang, dateKey),
    queryFn: () => fetchAndCacheDaily(getToken, lang, dateKey),
    staleTime: 5 * 60 * 1000,
  });
}
