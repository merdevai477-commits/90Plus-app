import { clearMp4PreflightCache, preflightDirectMp4 } from '../highlightMp4Preflight';

function mockResponse(status: number, ok?: boolean): Response {
  return {
    status,
    ok: ok ?? (status >= 200 && status < 300),
  } as Response;
}

describe('preflightDirectMp4', () => {
  beforeEach(() => {
    clearMp4PreflightCache();
  });

  it('accepts HTTP 206 Partial Content', async () => {
    const fetchImpl = jest.fn(async () => mockResponse(206));
    await expect(
      preflightDirectMp4('https://cdn.example.com/a.mp4', { fetchImpl: fetchImpl as typeof fetch }),
    ).resolves.toEqual({ ok: true, status: 206 });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://cdn.example.com/a.mp4',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Range: 'bytes=0-1' }),
      }),
    );
  });

  it('accepts HTTP 200 when the server ignores Range', async () => {
    const fetchImpl = jest.fn(async () => mockResponse(200));
    await expect(
      preflightDirectMp4('https://cdn.example.com/b.mp4', { fetchImpl: fetchImpl as typeof fetch }),
    ).resolves.toEqual({ ok: true, status: 200 });
  });

  it('maps 404 to SOURCE_NOT_FOUND', async () => {
    const fetchImpl = jest.fn(async () => mockResponse(404));
    await expect(
      preflightDirectMp4('https://cdn.example.com/missing.mp4', { fetchImpl: fetchImpl as typeof fetch }),
    ).resolves.toEqual({ ok: false, reason: 'SOURCE_NOT_FOUND', status: 404 });
  });

  it('maps 410 to SOURCE_EXPIRED', async () => {
    const fetchImpl = jest.fn(async () => mockResponse(410));
    await expect(
      preflightDirectMp4('https://cdn.example.com/gone.mp4', { fetchImpl: fetchImpl as typeof fetch }),
    ).resolves.toEqual({ ok: false, reason: 'SOURCE_EXPIRED', status: 410 });
  });

  it('does not treat generic 403 as GEO_RESTRICTED', async () => {
    const fetchImpl = jest.fn(async () => mockResponse(403));
    const result = await preflightDirectMp4('https://cdn.example.com/forbidden.mp4', {
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: 'UNKNOWN_ERROR', status: 403 });
  });

  it('follows redirects via fetch redirect: follow', async () => {
    const fetchImpl = jest.fn(async () => mockResponse(206));
    await preflightDirectMp4('https://cdn.example.com/redirect.mp4', {
      fetchImpl: fetchImpl as typeof fetch,
    });
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(firstCall[1]).toEqual(expect.objectContaining({ redirect: 'follow' }));
  });

  it('maps abort/timeout to PLAYBACK_TIMEOUT', async () => {
    const fetchImpl = jest.fn(async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    });
    await expect(
      preflightDirectMp4('https://cdn.example.com/slow.mp4', {
        fetchImpl: fetchImpl as typeof fetch,
        timeoutMs: 5,
      }),
    ).resolves.toEqual({ ok: false, reason: 'PLAYBACK_TIMEOUT' });
  });

  it('maps offline/network failures to NETWORK_ERROR', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    await expect(
      preflightDirectMp4('https://cdn.example.com/offline.mp4', {
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).resolves.toEqual({ ok: false, reason: 'NETWORK_ERROR' });
  });

  it('deduplicates concurrent validation for the same URL', async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    const fetchImpl = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = preflightDirectMp4('https://cdn.example.com/same.mp4', {
      fetchImpl: fetchImpl as typeof fetch,
    });
    const second = preflightDirectMp4('https://cdn.example.com/same.mp4', {
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    resolveFetch?.(mockResponse(206));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true, status: 206 },
      { ok: true, status: 206 },
    ]);
  });
});
