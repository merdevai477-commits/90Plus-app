import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { isDiagnosticsCapableBuild } from '../../services/diagnostics/diagnosticsConfig';
import {
  setDiagnosticsAuthTokenGetter,
  startDiagnosticsEngine,
} from '../../services/diagnostics/diagnosticsSession';

function DiagnosticsBootstrapCapable(): null {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    // One attempt per directive, no retry delays: a signed-out or slow token
    // only means user-targeted sessions are not matched this time.
    setDiagnosticsAuthTokenGetter(isSignedIn ? () => getToken() : null);
  }, [getToken, isSignedIn]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void startDiagnosticsEngine();
    });
    return () => task.cancel();
  }, []);

  return null;
}

function DiagnosticsBootstrapDisabled(): null {
  return null;
}

/**
 * Starts remote diagnostics after the first interactions on builds made with
 * EXPO_PUBLIC_DIAGNOSTICS=1. In every other build this renders nothing and
 * runs no hooks or effects.
 */
export const DiagnosticsBootstrap = isDiagnosticsCapableBuild()
  ? DiagnosticsBootstrapCapable
  : DiagnosticsBootstrapDisabled;
