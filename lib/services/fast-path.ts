export type FastPathResult<T> = {
  completed: boolean;
  timedOut: boolean;
  value?: T;
};

export async function withTimeBudget<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<FastPathResult<T>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<FastPathResult<T>>((resolve) => {
      timeoutHandle = setTimeout(() => {
        resolve({ completed: false, timedOut: true });
      }, timeoutMs);
    });

    const valuePromise = promise.then((value) => ({
      completed: true as const,
      timedOut: false as const,
      value,
    }));

    const result = await Promise.race([valuePromise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

