/** Runs `task` over `items`, at most `limit` at a time, keeping the results in the items' order. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Returns a function that runs tasks one after another, leaving at least
 * `intervalMs` between the start of one and the start of the next.
 */
export function spacedQueue(intervalMs: number): <R>(task: () => Promise<R>) => Promise<R> {
  let tail: Promise<unknown> = Promise.resolve();
  let lastStart = 0;
  return <R>(task: () => Promise<R>): Promise<R> => {
    const run = tail.then(async () => {
      const wait = lastStart + intervalMs - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      lastStart = Date.now();
      return task();
    });
    tail = run.catch(() => undefined);
    return run;
  };
}
