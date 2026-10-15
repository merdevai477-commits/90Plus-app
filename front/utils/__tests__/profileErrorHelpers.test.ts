import { isCooldownApiError } from '../profileErrorHelpers';

describe('isCooldownApiError', () => {
  it('detects top-level codes', () => {
    expect(isCooldownApiError({ code: 'COOLDOWN_ACTIVE' })).toBe(true);
    expect(isCooldownApiError({ errorCode: 'USERNAME_COOLDOWN' })).toBe(true);
    expect(isCooldownApiError({ error: 'E006' })).toBe(true);
  });

  it('detects details.code from sendCooldownError payloads', () => {
    expect(
      isCooldownApiError({
        status: 'ERROR',
        message: 'wait',
        details: { code: 'COOLDOWN_ACTIVE' },
      }),
    ).toBe(true);
  });

  it('rejects unrelated errors', () => {
    expect(isCooldownApiError({ code: 'VALIDATION' })).toBe(false);
    expect(isCooldownApiError(null)).toBe(false);
  });
});
