const sockets: Array<{
  connected: boolean;
  handlers: Record<string, (...args: unknown[]) => void>;
  on: jest.Mock;
  emit: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
  removeAllListeners: jest.Mock;
}> = [];

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const socket = {
      connected: false,
      handlers,
      on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
        handlers[event] = cb;
        return socket;
      }),
      emit: jest.fn(),
      connect: jest.fn(() => {
        socket.connected = true;
      }),
      disconnect: jest.fn(() => {
        socket.connected = false;
      }),
      removeAllListeners: jest.fn(() => {
        for (const key of Object.keys(handlers)) delete handlers[key];
      }),
    };
    sockets.push(socket);
    return socket;
  }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock('../../config/api.config', () => ({
  getWsUrl: jest.fn(() => 'wss://90plus.pro'),
}));

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../diagnostics/diagnosticsPipeline', () => ({
  armWsMatchUpdate: jest.fn(),
  clearWsArm: jest.fn(),
  recordWsState: jest.fn(),
}));

import { websocketClient } from '../websocketClient';
import { io } from 'socket.io-client';

const mockedIo = io as jest.Mock;

describe('websocket client lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    sockets.length = 0;
    mockedIo.mockClear();
    websocketClient.disconnect();
    websocketClient.setReconnectionConfig({ maxAttempts: 10, baseDelay: 1000, maxDelay: 30000, backoffMultiplier: 2 });
  });

  afterEach(() => {
    websocketClient.disconnect();
    jest.useRealTimers();
  });

  it('opens an initial connection', () => {
    websocketClient.connect('user-1');
    expect(mockedIo).toHaveBeenCalledTimes(1);
    expect(sockets[0].on).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('does not reconnect after an explicit disconnect', () => {
    websocketClient.connect('user-1');
    const staleDisconnect = sockets[0].handlers.disconnect;
    websocketClient.disconnect();
    staleDisconnect?.('io server disconnect');
    expect(sockets[0].connect).not.toHaveBeenCalled();
    websocketClient.resumeIfNeeded();
    expect(mockedIo).toHaveBeenCalledTimes(1);
  });

  it('allows reconnect after a new connection following disconnect', () => {
    websocketClient.connect('user-1');
    websocketClient.disconnect();
    websocketClient.connect('user-1');
    expect(mockedIo).toHaveBeenCalledTimes(2);
    sockets[1].handlers.connect_error?.({ message: 'network request failed' });
    expect(websocketClient.getReconnectAttempts()).toBe(0);
    jest.advanceTimersByTime(1000);
    expect(sockets[1].connect).toHaveBeenCalledTimes(1);
  });

  it('schedules another reconnect after the resumed connection fails', () => {
    websocketClient.setReconnectionConfig({ maxAttempts: 1, baseDelay: 1000, maxDelay: 30000, backoffMultiplier: 2 });
    websocketClient.connect('user-1');
    sockets[0].connected = true;
    sockets[0].handlers.disconnect?.('transport close');
    jest.advanceTimersByTime(1000);
    expect(websocketClient.getReconnectAttempts()).toBe(1);
    sockets[0].connected = false;
    sockets[0].handlers.disconnect?.('transport close');
    const connects = sockets[0].connect.mock.calls.length;
    jest.advanceTimersByTime(30_000);
    expect(sockets[0].connect.mock.calls.length).toBe(connects);
    websocketClient.resumeIfNeeded();
    expect(sockets[0].connect.mock.calls.length).toBe(connects + 1);
    sockets[0].connected = true;
    sockets[0].handlers.connect?.();
    sockets[0].connected = false;
    sockets[0].handlers.disconnect?.('transport close');
    jest.advanceTimersByTime(1000);
    expect(sockets[0].connect.mock.calls.length).toBe(connects + 2);
  });

  it('keeps a single live socket when connect is called twice', () => {
    websocketClient.connect('user-1');
    websocketClient.connect('user-2');
    expect(mockedIo).toHaveBeenCalledTimes(2);
    expect(sockets[0].removeAllListeners).toHaveBeenCalled();
    expect(sockets[0].disconnect).toHaveBeenCalled();
    expect(websocketClient.isConnected()).toBe(false);
  });

  it('ignores a disconnect callback from the replaced socket', () => {
    websocketClient.connect('user-1');
    const stale = sockets[0].handlers.disconnect;
    websocketClient.connect('user-1');
    stale?.('transport close');
    expect(sockets[1].connect).not.toHaveBeenCalled();
  });
});
