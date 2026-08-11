import { renderHook } from '@testing-library/react-hooks';

import { useDailySpin } from '../useDailySpin';
import { useAuth } from '@clerk/clerk-expo';
// ../../utils — same path the jest.mock() calls below already use. The imports
// pointed at ../utils (front/hooks/utils), which does not exist, so this file
// could not compile.
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { getClerkBearerToken } from '../../utils/clerkAuthToken';
import { useCoins } from '../../contexts/CoinsContext';

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

jest.mock('../../utils/clerkAuthToken', () => ({
  getClerkBearerToken: jest.fn(),
}));

jest.mock('../../contexts/CoinsContext', () => ({
  useCoins: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockedGetClerkBearerToken = getClerkBearerToken as jest.MockedFunction<typeof getClerkBearerToken>;
const mockedUseCoins = useCoins as jest.MockedFunction<typeof useCoins>;

describe('useDailySpin', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      getToken: jest.fn().mockResolvedValue('token'),
      isSignedIn: true,
    } as any);
    mockedGetClerkBearerToken.mockResolvedValue('token');
  });

  it('applies the backend balance when the spin succeeds', async () => {
    const applyCoinsBalance = jest.fn();
    const refreshCoins = jest.fn();
    mockedUseCoins.mockReturnValue({ applyCoinsBalance, refreshCoins } as any);

    mockedFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          prize: { prizeIndex: 1, coins: 10, label: '10' },
          newBalance: 110,
        },
      }),
    } as Response);

    const { result } = renderHook(() => useDailySpin());
    const attempt = await result.current.spin();

    expect(attempt.status).toBe('ok');
    expect(applyCoinsBalance).toHaveBeenCalledWith(110);
    expect(refreshCoins).toHaveBeenCalled();
  });

  it('does not mark the spin as successful when the server rejects it', async () => {
    const applyCoinsBalance = jest.fn();
    const refreshCoins = jest.fn();
    mockedUseCoins.mockReturnValue({ applyCoinsBalance, refreshCoins } as any);

    mockedFetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'db failed' } }),
    } as Response);

    const { result } = renderHook(() => useDailySpin());
    const attempt = await result.current.spin();

    expect(attempt.status).toBe('error');
    expect(applyCoinsBalance).not.toHaveBeenCalled();
    expect(refreshCoins).not.toHaveBeenCalled();
  });
});
