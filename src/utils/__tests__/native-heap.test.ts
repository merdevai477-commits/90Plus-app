import { startNativeHeapRelease, stopNativeHeapRelease } from '../native-heap';

describe('native heap release', () => {
  afterEach(() => {
    stopNativeHeapRelease();
  });

  it('starts and stops without throwing when libc is not available', () => {
    expect(() => startNativeHeapRelease()).not.toThrow();
    expect(() => stopNativeHeapRelease()).not.toThrow();
  });
});