import {
  initialMatchChatState,
  matchChatReducer,
  type MatchChatState,
} from '../matchLiveChat.reducer';
import type { MatchChatPublicMessage } from '../../types/matchChat';

const msg = (id: string, extra?: Partial<MatchChatPublicMessage>): MatchChatPublicMessage => ({
  id,
  matchId: 1,
  clientMessageId: id,
  text: id,
  createdAt: `2026-08-21T00:00:0${id.slice(-1)}.000Z`,
  user: { id: 'u1', username: 'a', displayName: 'A', avatar: null, favoriteTeam: null },
  ...extra,
});

describe('matchLiveChat reducer', () => {
  it('replaces optimistic pending with the accepted message', () => {
    let state: MatchChatState = matchChatReducer(initialMatchChatState, {
      type: 'optimistic',
      message: { ...msg('c1'), pending: true, id: 'c1' },
    });
    state = matchChatReducer(state, {
      type: 'accepted',
      message: msg('real', { clientMessageId: 'c1' }),
      ownUserId: 'u1',
    });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].id).toBe('real');
    expect(state.messages[0].pending).toBeFalsy();
  });

  it('increments unseen when not near the bottom', () => {
    const away: MatchChatState = { ...initialMatchChatState, nearBottom: false };
    const next = matchChatReducer(away, { type: 'accepted', message: msg('m9', { user: { id: 'other', username: 'x', displayName: null, avatar: null, favoriteTeam: null } }) });
    expect(next.unseenCount).toBe(1);
  });

  it('marks rejected client ids as failed', () => {
    const withPending = matchChatReducer(initialMatchChatState, {
      type: 'optimistic',
      message: { ...msg('c2'), pending: true },
    });
    const next = matchChatReducer(withPending, { type: 'rejected', clientMessageId: 'c2' });
    expect(next.messages[0].failed).toBe(true);
  });
});
