import { completeOAuthMissingRequirements } from '../oauthSignUpCompletion';

describe('completeOAuthMissingRequirements', () => {
  it('creates username from email when username is missing after OTP', async () => {
    const update = jest.fn().mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_test_123',
      missingFields: [],
    });

    const signUp = {
      update,
      missingFields: [],
      emailAddress: null,
      createdSessionId: null,
    };

    const result = await completeOAuthMissingRequirements(signUp, {
      legalAccepted: true,
      missingFields: ['username'],
      email: 'ahmed.mohamed@example.com',
    });

    expect(result.kind).toBe('session');
    if (result.kind === 'session') {
      expect(result.sessionId).toBe('sess_test_123');
    }
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        legalAccepted: true,
        username: expect.stringMatching(/^ahmed_mohamed_\d{4}$/),
      }),
    );
  });
});
