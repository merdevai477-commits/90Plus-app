/**
 * Shows the rating prompt after install delay + session dwell time.
 * Skips while a force-update gate is up.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from '../../src/i18n';
import { openAppStoreForRating } from '../../constants/shareLinks';
import { logger } from '../../services/logger';
import {
  completeRatingPrompt,
  ensureRatingFirstOpenRecorded,
  markRatingPromptShown,
  shouldShowRatingPrompt,
  snoozeRatingPrompt,
  RATING_MIN_SESSION_MS,
} from '../../services/appRatingPrompt';
import { AppRatingModal } from './AppRatingModal';
import { toastManager } from '../../services/toastManager';

type Props = {
  /** When true, do not show the rating modal (e.g. force update). */
  blocked?: boolean;
};

export function AppRatingBootstrap({ blocked = false }: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const sessionStartedAt = useRef(Date.now());
  const shownThisSession = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void ensureRatingFirstOpenRecorded();
  }, []);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        sessionStartedAt.current = Date.now();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (blocked || shownThisSession.current) return;

    const tryShow = async () => {
      try {
        const ok = await shouldShowRatingPrompt(sessionStartedAt.current);
        if (!ok || shownThisSession.current || blocked) return;
        shownThisSession.current = true;
        await markRatingPromptShown();
        setVisible(true);
      } catch (err) {
        logger.warn('[AppRating] Failed to evaluate prompt:', err);
      }
    };

    // Poll until session dwell time is met, then decide once.
    const tick = () => {
      const elapsed = Date.now() - sessionStartedAt.current;
      const wait = Math.max(1_000, RATING_MIN_SESSION_MS - elapsed + 500);
      timerRef.current = setTimeout(() => {
        void tryShow();
      }, wait);
    };

    tick();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [blocked]);

  const handleSubmit = async (stars: number) => {
    setVisible(false);
    try {
      await completeRatingPrompt(stars);
      if (stars >= 4) {
        const opened = await openAppStoreForRating();
        if (!opened) {
          toastManager.showInfo(t.settings.rateThanks, t.settings.rateThanksDetail);
        }
      } else {
        toastManager.showSuccess(
          t.appRating.thanksTitle,
          t.appRating.thanksLowDetail,
        );
      }
    } catch (err) {
      logger.warn('[AppRating] Submit failed:', err);
    }
  };

  const handleLater = async () => {
    setVisible(false);
    try {
      await snoozeRatingPrompt();
    } catch (err) {
      logger.warn('[AppRating] Snooze failed:', err);
    }
  };

  return (
    <AppRatingModal
      visible={visible}
      title={t.appRating.title}
      subtitle={t.appRating.subtitle}
      submitLabel={t.appRating.submit}
      laterLabel={t.appRating.later}
      onSubmit={handleSubmit}
      onLater={handleLater}
    />
  );
}
