jest.mock('@clerk/clerk-expo', () => ({
  useAuth: jest.fn(() => ({ getToken: jest.fn(), isSignedIn: false })),
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  InteractionManager: { runAfterInteractions: jest.fn(() => ({ cancel: jest.fn() })) },
}));

describe('DiagnosticsBootstrap', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_DIAGNOSTICS;
  });

  it('is an inert component without hooks in builds without the diagnostics flag', () => {
    jest.isolateModules(() => {
      const { DiagnosticsBootstrap } = require('../../../components/common/DiagnosticsBootstrap');
      const { useAuth } = require('@clerk/clerk-expo');
      const { InteractionManager } = require('react-native');
      expect(DiagnosticsBootstrap.name).toBe('DiagnosticsBootstrapDisabled');
      expect(DiagnosticsBootstrap()).toBeNull();
      expect(useAuth).not.toHaveBeenCalled();
      expect(InteractionManager.runAfterInteractions).not.toHaveBeenCalled();
    });
  });

  it('selects the capable component only when EXPO_PUBLIC_DIAGNOSTICS=1', () => {
    process.env.EXPO_PUBLIC_DIAGNOSTICS = '1';
    jest.isolateModules(() => {
      const { DiagnosticsBootstrap } = require('../../../components/common/DiagnosticsBootstrap');
      expect(DiagnosticsBootstrap.name).toBe('DiagnosticsBootstrapCapable');
    });
  });
});
