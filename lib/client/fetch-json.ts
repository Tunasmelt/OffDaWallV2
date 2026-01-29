type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

type FetchJsonOptions = {
  ttlMs?: number;
  cacheKey?: string;
  signal?: AbortSignal;
  shouldCache?: (data: any) => boolean;
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
};

const responseCache = new Map<string, CacheEntry<any>>();
const inFlight = new Map<string, Promise<any>>();

function isFresh(entry: CacheEntry<any>) {
  return Date.now() < entry.expiresAt;
}

export async function fetchJsonCached<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const {
    ttlMs = 30_000,
    cacheKey = url,
    signal,
    shouldCache,
    timeoutMs,
    retryCount = 0,
    retryDelayMs = 400,
  } = options;

  const cached = responseCache.get(cacheKey);
  if (cached && isFresh(cached)) {
    return cached.data as T;
  }

  const existing = inFlight.get(cacheKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const request = (async () => {
    let attempt = 0;
    while (attempt <= retryCount) {
      let didTimeout = false;
      let externalAbort = false;
      const controller = new AbortController();
      const abortHandler = () => {
        externalAbort = true;
        controller.abort();
      };
      if (signal) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        signal.addEventListener('abort', abortHandler, { once: true });
      }
      const timeout = timeoutMs
        ? setTimeout(() => {
            didTimeout = true;
            controller.abort();
          }, timeoutMs)
        : null;

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const payload: any = await res.json();
        const data = payload && payload.ok === true && 'data' in payload ? payload.data : payload;
        if (payload && payload.ok === false) {
          throw new Error(payload?.error?.message || 'Request failed');
        }
        const allowCache = shouldCache ? shouldCache(data) : true;
        if (allowCache) {
          responseCache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
        }
        return data as T;
      } catch (error) {
        if (externalAbort) {
          throw error;
        }
        if (attempt < retryCount && (didTimeout || (error as Error)?.name !== 'AbortError')) {
          attempt += 1;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
          continue;
        }
        throw error;
      } finally {
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        if (timeout) {
          clearTimeout(timeout);
        }
      }
    }

    throw new Error('Request failed');
  })().finally(() => {
    inFlight.delete(cacheKey);
  });

  inFlight.set(cacheKey, request);
  return request;
}
