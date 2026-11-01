import { createRequire } from 'module';
import { logger } from './logger';

const nodeRequire = createRequire(__filename);

/**
 * Railway counts RSS, not the V8 heap. This process's heap stays near 200MB
 * while RSS climbs toward 2GB: glibc keeps freed pages, and the kernel pins
 * them in transparent huge pages so they cannot be returned.
 *
 * arena_max=2 is already set and only caps extra arenas. PR_SET_THP_DISABLE
 * opts this process out of huge pages, and malloc_trim hands freed pages back.
 * GLIBC_TUNABLES must still set trim_threshold and mmap_threshold before start;
 * those are read by libc, not by this file.
 */
const PR_SET_THP_DISABLE = 41;
const TRIM_EVERY_MS = 5 * 60 * 1000;

type MallocTrim = (pad: number) => number;

let mallocTrim: MallocTrim | null = null;
let trimTimer: ReturnType<typeof setInterval> | null = null;

function bindLibc(): void {
  if (process.platform !== 'linux' || mallocTrim) return;
  try {
    const koffi = nodeRequire('koffi') as {
      load: (file: string) => {
        func: (declaration: string) => (...args: number[]) => number;
      };
    };
    const libc = koffi.load('libc.so.6');
    // Fixed prototype: a variadic declaration makes koffi treat the numeric
    // arguments as type names and throw before prctl runs.
    const prctl = libc.func(
      'int prctl(int option, unsigned long arg2, unsigned long arg3, unsigned long arg4, unsigned long arg5)',
    );
    const rc = prctl(PR_SET_THP_DISABLE, 1, 0, 0, 0);
    if (rc === 0) {
      logger.info('[Memory] transparent huge pages disabled for this process');
    } else {
      logger.warn(`[Memory] prctl(PR_SET_THP_DISABLE) returned ${rc}`);
    }
    mallocTrim = libc.func('int malloc_trim(size_t pad)');
  } catch (error) {
    logger.warn('[Memory] native heap release unavailable', (error as Error)?.message ?? error);
  }
}

export function startNativeHeapRelease(): void {
  bindLibc();
  if (!mallocTrim || trimTimer) return;
  const trim = mallocTrim;
  trimTimer = setInterval(() => {
    try {
      const before = process.memoryUsage().rss;
      trim(0);
      const freedMb = (before - process.memoryUsage().rss) / (1024 * 1024);
      if (freedMb >= 64) {
        logger.info(`[Memory] malloc_trim released ${Math.round(freedMb)}MB`);
      }
    } catch (error) {
      logger.warn('[Memory] malloc_trim failed', (error as Error)?.message ?? error);
    }
  }, TRIM_EVERY_MS);
  trimTimer.unref();
}

export function stopNativeHeapRelease(): void {
  if (!trimTimer) return;
  clearInterval(trimTimer);
  trimTimer = null;
}
