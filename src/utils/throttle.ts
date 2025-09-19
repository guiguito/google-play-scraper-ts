type ThrottleOptions = {
  interval: number; // ms window
  limit: number; // max ops per window
};

export function throttled<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  opts: ThrottleOptions
): (...args: TArgs) => Promise<TResult> {
  const { interval, limit } = opts;
  let tokens = limit;
  const queue: Array<{ args: TArgs; resolve: (value: TResult) => void; reject: (reason: unknown) => void }> = [];

  setInterval(() => {
    tokens = limit;
    drain();
  }, interval).unref?.();

  function drain() {
    while (tokens > 0 && queue.length > 0) {
      tokens--;
      const item = queue.shift();
      if (!item) break;
      const { args, resolve, reject } = item;
      fn(...args).then(resolve, reject);
    }
  }

  return function throttledFn(...args: TArgs): Promise<TResult> {
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject });
      drain();
    });
  };
}
