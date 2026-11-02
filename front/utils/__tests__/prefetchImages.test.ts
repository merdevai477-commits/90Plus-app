import { Image } from 'expo-image';
import { prefetchImages } from '../prefetchImages';

jest.mock('expo-image', () => ({
  Image: { prefetch: jest.fn() },
}));

const prefetch = Image.prefetch as jest.Mock;

beforeEach(() => {
  prefetch.mockReset();
});

describe('prefetchImages', () => {
  it('gives every URL its own native call, so no native promise is shared between downloads', async () => {
    prefetch.mockResolvedValue(true);

    await prefetchImages(['https://img.test/a.png', 'https://img.test/b.png'], 'memory-disk');

    expect(prefetch.mock.calls).toEqual([
      ['https://img.test/a.png', 'memory-disk'],
      ['https://img.test/b.png', 'memory-disk'],
    ]);
  });

  it('waits for the whole batch even when an image fails', async () => {
    let finishSlow: (ok: boolean) => void = () => {};
    prefetch
      .mockRejectedValueOnce(new Error('network'))
      .mockReturnValueOnce(new Promise<boolean>((resolve) => { finishSlow = resolve; }));

    let done = false;
    const batch = prefetchImages(['https://img.test/a.png', 'https://img.test/b.png']).then(() => {
      done = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(done).toBe(false);

    finishSlow(true);
    await batch;
    expect(done).toBe(true);
  });
});
