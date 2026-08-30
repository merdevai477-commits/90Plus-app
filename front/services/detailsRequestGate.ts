/**
 * Global concurrency gate for /details fixture requests.
 * Prevents per-fixture stampede when many live matches register interest at once.
 */

import { isAbortError } from '../utils/isAbortError';

interface GateEntry<T> {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  priority: number;
  aborted: boolean;
  removeAbortListener?: () => void;
}

class DetailsRequestGate {
  private queue: GateEntry<unknown>[] = [];
  private active = 0;
  readonly maxConcurrent = 3;

  enqueue<T>(
    run: () => Promise<T>,
    options: { priority?: number; signal?: AbortSignal } = {},
  ): Promise<T> {
    const { priority = 0, signal } = options;

    if (signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    return new Promise<T>((resolve, reject) => {
      const entry: GateEntry<T> = {
        run,
        resolve,
        reject,
        priority,
        aborted: false,
      };

      const onAbort = () => {
        entry.aborted = true;
        const idx = this.queue.indexOf(entry as GateEntry<unknown>);
        if (idx >= 0) {
          this.queue.splice(idx, 1);
          reject(createAbortError());
        }
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
        entry.removeAbortListener = () => signal.removeEventListener('abort', onAbort);
      }

      const insertIndex = this.queue.findIndex((e) => e.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(entry as GateEntry<unknown>);
      } else {
        this.queue.splice(insertIndex, 0, entry as GateEntry<unknown>);
      }

      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const entry = this.queue.shift();
      if (!entry || entry.aborted) continue;

      this.active++;
      entry
        .run()
        .then(entry.resolve)
        .catch((error) => {
          if (!entry.aborted || !isAbortError(error)) {
            entry.reject(error);
          }
        })
        .finally(() => {
          entry.removeAbortListener?.();
          this.active--;
          this.drain();
        });
    }
  }

  getStatus(): { queueLength: number; active: number; maxConcurrent: number } {
    return {
      queueLength: this.queue.length,
      active: this.active,
      maxConcurrent: this.maxConcurrent,
    };
  }

  /** Reset gate state (tests only). */
  clear(): void {
    for (const entry of this.queue) {
      entry.removeAbortListener?.();
      entry.reject(new Error('Gate cleared'));
    }
    this.queue = [];
    this.active = 0;
  }
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

export const detailsRequestGate = new DetailsRequestGate();
export default detailsRequestGate;
