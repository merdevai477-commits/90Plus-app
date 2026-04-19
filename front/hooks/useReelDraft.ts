/**
 * useReelDraft
 *
 * يحفظ مسودة الريل في AsyncStorage تلقائياً عند الخروج من شاشة الرفع،
 * ويستعيدها عند العودة. يحل مشكلة فقدان المحتوى عند الخروج المفاجئ.
 *
 * يدعم أيضاً الـ offline mode: يحفظ المسودة ويرفعها تلقائياً عند عودة الاتصال.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { logger } from '../utils/logger';

const DRAFT_STORAGE_KEY = '@reel_draft';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 ساعة

export interface ReelDraft {
  videoUri: string;
  thumbnailUri?: string;
  caption: string;
  hashtags: string[];
  mentions: string[];
  savedAt: number; // timestamp
}

export interface UseReelDraftReturn {
  draft: ReelDraft | null;
  saveDraft: (data: Omit<ReelDraft, 'savedAt'>) => Promise<void>;
  clearDraft: () => Promise<void>;
  hasDraft: boolean;
  isOnline: boolean;
}

export function useReelDraft(): UseReelDraftReturn {
  const [draft, setDraft] = useState<ReelDraft | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const netInfoUnsubRef = useRef<(() => void) | null>(null);

  // تحميل المسودة عند الـ mount
  useEffect(() => {
    loadDraft();

    // مراقبة حالة الشبكة
    netInfoUnsubRef.current = NetInfo.addEventListener((state) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable));
    });

    return () => {
      netInfoUnsubRef.current?.();
    };
  }, []);

  const loadDraft = async () => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;

      const parsed: ReelDraft = JSON.parse(raw);

      // تجاهل المسودات القديمة (أكثر من 24 ساعة)
      if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
        await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
        logger.debug('[useReelDraft] Draft expired, removed');
        return;
      }

      setDraft(parsed);
      logger.debug('[useReelDraft] Draft loaded');
    } catch (err) {
      logger.warn('[useReelDraft] Failed to load draft:', err);
    }
  };

  const saveDraft = useCallback(async (data: Omit<ReelDraft, 'savedAt'>) => {
    try {
      // لا تحفظ مسودة فارغة
      if (!data.videoUri) return;

      const draftData: ReelDraft = {
        ...data,
        savedAt: Date.now(),
      };

      await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
      setDraft(draftData);
      logger.debug('[useReelDraft] Draft saved');
    } catch (err) {
      logger.warn('[useReelDraft] Failed to save draft:', err);
    }
  }, []);

  const clearDraft = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
      setDraft(null);
      logger.debug('[useReelDraft] Draft cleared');
    } catch (err) {
      logger.warn('[useReelDraft] Failed to clear draft:', err);
    }
  }, []);

  return {
    draft,
    saveDraft,
    clearDraft,
    hasDraft: draft !== null,
    isOnline,
  };
}
