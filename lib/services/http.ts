type HttpJsonOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: number[];
  headers?: Record<string, string>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
  config: HttpJsonOptions = {}
): Promise<T> {
  const {
    timeoutMs = 4000,
    retries = 1,
    retryDelayMs = 250,
    retryOnStatuses = [429, 500, 502, 503, 504],
    headers = {},
  } = config;

  let attempt = 0;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          ...headers,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        if (retryOnStatuses.includes(res.status) && attempt < retries) {
          attempt += 1;
          await sleep(retryDelayMs * attempt);
          continue;
        }
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      return (await res.json()) as T;
    } catch (error) {
      if (attempt < retries) {
        attempt += 1;
        await sleep(retryDelayMs * attempt);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('fetchJson failed');
}
