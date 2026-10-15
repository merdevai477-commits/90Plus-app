/**
 * Checks store / server version on launch.
 * Force update → blocking modal.
 * Soft update → dismissible modal + one local notification per version.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useTranslation } from '../../src/i18n';
import { logger } from '../../services/logger';
import {
  checkAppVersion,
  type AppVersionInfo,
} from '../../services/appVersionService';
import {
  markUpdatePromptDismissed,
  notifyAppUpdateAvailable,
  wasUpdatePromptDismissed,
} from '../../services/appUpdateNotify';
import { getStoreUrl } from '../../constants/shareLinks';
import { AppUpdateModal } from './AppUpdateModal';

type Props = {
  onForceChange?: (force: boolean) => void;
};

export function AppUpdateBootstrap({ onForceChange }: Props) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<AppVersionInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const versionInfo = await checkAppVersion();
        if (!versionInfo) return;

        if (versionInfo.maintenance) {
          setInfo(versionInfo);
          setVisible(true);
          onForceChange?.(true);
          return;
        }

        if (!versionInfo.needsUpdate && !versionInfo.updateAvailable) return;

        const force = !!versionInfo.forceUpdate;
        if (!force) {
          const dismissed = await wasUpdatePromptDismissed(versionInfo.currentVersion);
          if (dismissed) {
            // Still notify once if we never did for this version
            await notifyAppUpdateAvailable({
              latestVersion: versionInfo.currentVersion,
              title: t.appUpdate.notifyTitle,
              body: versionInfo.updateMessage || t.appUpdate.softMessage,
              updateUrl: versionInfo.updateUrl || getStoreUrl(),
            });
            return;
          }
        }

        setInfo(versionInfo);
        setVisible(true);
        onForceChange?.(force);

        if (!force) {
          await notifyAppUpdateAvailable({
            latestVersion: versionInfo.currentVersion,
            title: t.appUpdate.notifyTitle,
            body: versionInfo.updateMessage || t.appUpdate.softMessage,
            updateUrl: versionInfo.updateUrl || getStoreUrl(),
          });
        }
      } catch (err) {
        logger.warn('[AppUpdate] Version check failed:', err);
      }
    })();
    // Run once on mount — copy is read from current language at check time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openStore = useCallback(async () => {
    const url = info?.updateUrl || getStoreUrl();
    try {
      await Linking.openURL(url);
    } catch (err) {
      logger.warn('[AppUpdate] Failed to open store URL:', err);
    }
  }, [info?.updateUrl]);

  const handleLater = useCallback(async () => {
    if (info?.forceUpdate || info?.maintenance) return;
    setVisible(false);
    onForceChange?.(false);
    if (info?.currentVersion) {
      await markUpdatePromptDismissed(info.currentVersion);
    }
  }, [info, onForceChange]);

  if (!info) return null;

  const force = !!(info.forceUpdate || info.maintenance);
  const title = info.maintenance
    ? t.appUpdate.maintenanceTitle
    : force
      ? t.appUpdate.forceTitle
      : t.appUpdate.softTitle;
  const message = info.maintenance
    ? info.maintenanceMessage || t.appUpdate.maintenanceMessage
    : info.updateMessage || (force ? t.appUpdate.forceMessage : t.appUpdate.softMessage);

  return (
    <AppUpdateModal
      visible={visible}
      force={force}
      title={title}
      message={message}
      updateLabel={t.appUpdate.updateNow}
      laterLabel={t.appUpdate.later}
      onUpdate={openStore}
      onLater={handleLater}
    />
  );
}
