/**
 * Combines store-update gate + delayed rating prompt.
 * Rating is blocked while a force update / maintenance modal is up.
 */

import React, { useCallback, useState } from 'react';
import { AppUpdateBootstrap } from './AppUpdateBootstrap';
import { AppRatingBootstrap } from './AppRatingBootstrap';

export function AppEngagementBootstrap() {
  const [forceGate, setForceGate] = useState(false);
  const onForceChange = useCallback((force: boolean) => {
    setForceGate(force);
  }, []);

  return (
    <>
      <AppUpdateBootstrap onForceChange={onForceChange} />
      <AppRatingBootstrap blocked={forceGate} />
    </>
  );
}
