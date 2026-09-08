jest.mock('../../config/api.config', () => ({
  getApiUrl: () => 'https://90plus.pro/api',
}));

import { fetchStadiumImageByName, isUnverifiedStadiumCdnUrl } from '../fetchStadiumImage';

describe('fetchStadiumImage helpers', () => {
  it('flags constructed 365 venue CDN URLs as unverified', () => {
    expect(
      isUnverifiedStadiumCdnUrl(
        'https://imagecache.365scores.com/image/upload/f_jpg,w_800,h_450,c_fill,q_auto:eco/v1/Venues/88',
      ),
    ).toBe(true);
    expect(isUnverifiedStadiumCdnUrl('https://upload.wikimedia.org/anfield.jpg')).toBe(false);
  });

  it('reads imageUrl from the stadium-image API payload', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: { imageUrl: 'https://upload.wikimedia.org/anfield.jpg' } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(fetchStadiumImageByName('Anfield', 'England')).resolves.toBe(
      'https://upload.wikimedia.org/anfield.jpg',
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain('/football/stadium-image?');
    expect(String(fetchMock.mock.calls[0][0])).toContain('name=Anfield');
  });
});
