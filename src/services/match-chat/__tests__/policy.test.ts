import { MATCH_CHAT_CONFIG } from '../../../config/match-chat.config';
import { applyModerationStrike, getFrozenUntil, resetLocalPolicyState } from '../match-chat.policy';

describe('match-chat policy', () => {
  beforeEach(() => {
    resetLocalPolicyState();
  });

  it('warns on the first abusive strike then freezes on the second', async () => {
    const t0 = Date.now();
    const first = await applyModerationStrike('user-1', 'INSULT', t0);
    expect(first.kind).toBe('warn');
    expect(await getFrozenUntil('user-1')).toBeNull();

    const second = await applyModerationStrike('user-1', 'PROFANITY', t0 + 1000);
    expect(second.kind).toBe('freeze');
    expect(second.remainingMs).toBe(MATCH_CHAT_CONFIG.freezeMs);
    const until = await getFrozenUntil('user-1');
    expect(until).toBe(t0 + 1000 + MATCH_CHAT_CONFIG.freezeMs);
  });

  it('freezes immediately for threats', async () => {
    const t0 = Date.now();
    const result = await applyModerationStrike('user-2', 'THREAT', t0);
    expect(result.kind).toBe('freeze');
    expect(await getFrozenUntil('user-2')).toBeGreaterThan(t0);
  });

  it('treats freeze as expired after frozenUntil', async () => {
    await applyModerationStrike('user-3', 'HATE', Date.now() - MATCH_CHAT_CONFIG.freezeMs - 1000);
    expect(await getFrozenUntil('user-3')).toBeNull();
  });
});
