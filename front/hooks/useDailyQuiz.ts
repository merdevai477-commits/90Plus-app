/**
 * useDailyQuiz — AsyncStorage-backed daily quiz with image prefetch.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { getClerkBearerToken } from '../utils/clerkAuthToken';
import {
  QuizApiService,
  type QuizApiLanguage,
  type QuizDailyPayload,
} from '../services/quizApi.service';

import * as Localization from 'expo-localization';

function todayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDeviceTimezone(): string {
  try {
    return Localization.getCalendars()[0]?.timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

function storageKey(lang: QuizApiLanguage): string {
  return `quiz_daily_${lang}_${todayDateKey()}`;
}

export async function readCachedDailyQuiz(
  lang: QuizApiLanguage,
): Promise<QuizDailyPayload | undefined> {
  try {
    const raw = await (await import('@react-native-async-storage/async-storage')).default.getItem(
      storageKey(lang),
    );
    if (!raw) return undefined;
    return JSON.parse(raw) as QuizDailyPayload;
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
    await AsyncStorage.setItem(storageKey(lang), JSON.stringify(data));
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
): Promise<QuizDailyPayload> {
  const token = await getClerkBearerToken(getToken);
  if (!token) throw new Error('AUTH_REQUIRED');
  const data = await QuizApiService.fetchDaily(token, lang);
  if (!data?.questions?.length) throw new Error('EMPTY_PACK');
  await persistDailyQuiz(lang, data);
  prefetchQuizImages(data.questions, data.currentIndex ?? 0);
  return data;
}

export function useDailyQuiz(lang: QuizApiLanguage) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [cachedData, setCachedData] = useState<QuizDailyPayload | undefined>();

  useEffect(() => {
    let cancelled = false;
    void readCachedDailyQuiz(lang).then((data) => {
      if (!cancelled) setCachedData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  return useQuery({
    queryKey: ['dailyQuiz', lang],
    queryFn: () => fetchAndCacheDaily(getToken, lang),
    enabled: Boolean(lang) && isLoaded === true && isSignedIn === true,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: cachedData,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message === 'AUTH_REQUIRED') return false;
      if (err instanceof Error && err.message === 'RATE_LIMIT') return false;
      return failureCount < 2;
    },
  });
}

export async function prefetchDailyQuiz(
  queryClient: QueryClient,
  getToken: () => Promise<string | null>,
  lang: QuizApiLanguage,
): Promise<void> {
  const cached = await readCachedDailyQuiz(lang);
  if (cached) {
    queryClient.setQueryData(['dailyQuiz', lang], cached);
    prefetchQuizImages(cached.questions, cached.currentIndex ?? 0);
  }

  const token = await getClerkBearerToken(getToken);
  if (!token) return;

  await queryClient.prefetchQuery({
    queryKey: ['dailyQuiz', lang],
    queryFn: () => fetchAndCacheDaily(getToken, lang),
    staleTime: 5 * 60 * 1000,
  });
}
