/**
 * Tiny in-repo concurrency limiter — a CommonJS-safe replacement for p-limit.
 *
 * Modern p-limit (v4+) is pure ESM and breaks this project's CommonJS build
 * (tsc + ts-node with require). This helper provides the same call shape:
 *
 *   const limit = pLimit(3);
 *   await Promise.all(items.map((it) => limit(() => doWork(it))));
 *
 * Tasks beyond the concurrency cap queue and run as slots free up. Each task's
 * settle (resolve OR reject) releases its slot, so a rejected task never stalls
 * the queue.
 */

export type LimitFunction = <T>(fn: () => Promise<T>) => Promise<T>;

export function pLimit(concurrency: number): LimitFunction {
  const max = Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 1;

  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = (): void => {
    activeCount -= 1;
    if (queue.length > 0) {
      const run = queue.shift();
      if (run) run();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = (): void => {
        activeCount += 1;
        // Defer to a microtask so synchronous throws inside fn() are captured
        // as rejections rather than escaping the limiter.
        Promise.resolve()
          .then(fn)
          .then(
            (value) => {
              resolve(value);
              next();
            },
            (err) => {
              reject(err);
              next();
            },
          );
      };

      if (activeCount < max) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}
