/**
 * Native modules the Football Grid screen imports that jest-expo cannot
 * instantiate (they resolve to real native view managers).
 *
 * Each is replaced by the plainest possible host component so the tree still
 * renders and its children/props stay queryable. Nothing about the grid's own
 * logic is stubbed — only the platform widgets it draws into.
 */
jest.mock('expo-image', () => {
  const Reactl = require('react');
  const { View: V } = require('react-native');
  return {
    Image: (props) => Reactl.createElement(V, { ...props, testID: props.testID ?? 'expo-image' }),
  };
});

jest.mock('expo-linear-gradient', () => {
  const Reactl = require('react');
  const { View: V } = require('react-native');
  return { LinearGradient: (props) => Reactl.createElement(V, props, props.children) };
});

jest.mock('react-native-safe-area-context', () => {
  const Reactl = require('react');
  const { View: V } = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaProvider: (props) => Reactl.createElement(V, props, props.children),
    SafeAreaView: (props) => Reactl.createElement(V, props, props.children),
  };
});

jest.mock('expo-blur', () => {
  const Reactl = require('react');
  const { View: V } = require('react-native');
  return { BlurView: (props) => Reactl.createElement(V, props, props.children) };
});

// Every icon is a plain view — the grid asserts text and behaviour, not glyphs.
jest.mock('lucide-react-native', () => {
  const Reactl = require('react');
  const { View: V } = require('react-native');
  return new Proxy(
    {},
    {
      get: (_target, name) => {
        if (name === '__esModule') return true;
        return (props) => Reactl.createElement(V, props);
      },
    },
  );
});

// Connectivity: always online, so the app's network guard never short-circuits
// the request this test exists to make.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: async () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
    addEventListener: () => () => {},
    configure: () => {},
  },
  fetch: async () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
  addEventListener: () => () => {},
}));

// AsyncStorage's own documented jest mock (there is no native module here).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Reanimated's mock ships with the library and is the supported way to test it.
try {
  require('react-native-reanimated/mock');
} catch {
  /* not installed — nothing to mock */
}
