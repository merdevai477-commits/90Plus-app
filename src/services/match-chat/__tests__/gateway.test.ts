import { MATCH_CHAT_EVENTS } from '../match-chat.types';
import { MatchChatGateway } from '../match-chat.gateway';
import { loadJoinHistory } from '../match-chat.service';

jest.mock('../match-chat.repository', () => ({
  getRecentMessages: jest.fn(async () => [
    {
      id: 'm1',
      matchId: 7,
      clientMessageId: 'c1',
      text: 'hello',
      createdAt: '2026-08-21T00:00:00.000Z',
      user: { id: 'u1', username: 'a', displayName: 'A', avatar: null, favoriteTeam: null },
    },
    {
      id: 'm2',
      matchId: 7,
      clientMessageId: 'c2',
      text: 'blocked',
      createdAt: '2026-08-21T00:00:01.000Z',
      user: { id: 'u2', username: 'b', displayName: 'B', avatar: null, favoriteTeam: null },
    },
    {
      id: 'm3',
      matchId: 7,
      clientMessageId: 'c3',
      text: 'world',
      createdAt: '2026-08-21T00:00:02.000Z',
      user: { id: 'u1', username: 'a', displayName: 'A', avatar: null, favoriteTeam: null },
    },
  ]),
  getHistoryFromPostgres: jest.fn(async () => ({ messages: [], hasMore: false })),
  getBlockedPairIds: jest.fn(async () => new Set(['u2'])),
  pushRecentMessage: jest.fn(),
  persistMatchChatMessage: jest.fn(),
  buildPublicMessage: jest.fn(),
}));

describe('match-chat gateway helpers / join gap fill', () => {
  it('exposes the documented event names', () => {
    expect(MATCH_CHAT_EVENTS.join).toBe('chat:join');
    expect(MATCH_CHAT_EVENTS.send).toBe('message:send');
    expect(MATCH_CHAT_EVENTS.frozen).toBe('user:frozen');
  });

  it('does not throw when emitting before attach', () => {
    expect(() => MatchChatGateway.emitDeleted(1, 'x')).not.toThrow();
    expect(() => MatchChatGateway.emitUnfrozen('u')).not.toThrow();
  });

  it('fills missed messages since lastMessageId and hides blocked users', async () => {
    const result = await loadJoinHistory(7, 'viewer', 'm1');
    expect(result.messages.map((m) => m.id)).toEqual(['m1', 'm3']);
    expect(result.missed.map((m) => m.id)).toEqual(['m3']);
  });
});
