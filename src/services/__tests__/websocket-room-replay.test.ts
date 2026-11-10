import { WebSocketService } from '../websocket.service';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/lag-audit', () => ({
  lagAudit: jest.fn(),
}));

jest.mock('../match-chat/match-chat.gateway', () => ({
  MatchChatGateway: { attach: jest.fn() },
}));

describe('websocket room replay', () => {
  it('replays the last match payload to the subscribing socket only', () => {
    WebSocketService.sendMatchUpdate(88, {
      matchId: 88,
      homeScore: 2,
      awayScore: 1,
      status: '2H',
      minute: 70,
    });
    const socket = { id: 'sock-1', join: jest.fn(), emit: jest.fn() };
    WebSocketService.handleRoomSubscribe(socket as never, 'match:88');
    expect(socket.join).toHaveBeenCalledWith('match:88');
    expect(socket.emit).toHaveBeenCalledWith(
      'match_update',
      expect.objectContaining({
        type: 'match_update',
        timestamp: expect.any(Number),
        payload: expect.objectContaining({ homeScore: 2, awayScore: 1, minute: 70 }),
      }),
    );
  });
});
