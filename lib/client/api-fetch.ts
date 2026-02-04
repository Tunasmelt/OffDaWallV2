import type { ApiResponse } from '@/lib/contracts/api';

type CacheEntry<T> = {
  data: T;
  meta?: any;
  expiresAt: number;
};

type ApiFetchOptions = {
  ttlMs?: number;
  cacheKey?: string;
  signal?: AbortSignal;
  shouldCache?: (data: any) => boolean;
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
  instanceId?: string;
};

const responseCache = new Map<string, CacheEntry<any>>();
const inFlight = new Map<string, Promise<any>>();

function isFresh(entry: CacheEntry<any>) {
  return Date.now() < entry.expiresAt;
}

export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const {
    ttlMs = 30_000,
    cacheKey = url,
    signal,
    shouldCache,
    timeoutMs,
    retryCount = 0,
    retryDelayMs = 400,
    instanceId,
  } = options;

  const cached = responseCache.get(cacheKey);
  if (cached && isFresh(cached)) {
    return cached.data as T;
  }

  const inFlightKey = signal
    ? `${cacheKey}:${instanceId ?? Math.random().toString(36).slice(2, 8)}`
    : cacheKey;

  const existing = inFlight.get(inFlightKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const request = (async () => {
    let attempt = 0;
    while (attempt <= retryCount) {
      let didTimeout = false;
      const controller = new AbortController();
      let abortPromise: Promise<never> | null = null;
      let abortHandler: (() => void) | null = null;

      if (signal) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        abortPromise = new Promise((_, reject) => {
          abortHandler = () => reject(new DOMException('Aborted', 'AbortError'));
          signal.addEventListener('abort', abortHandler, { once: true });
        });
      }

      const timeout = timeoutMs
        ? setTimeout(() => {
            didTimeout = true;
            controller.abort();
          }, timeoutMs)
        : null;

      try {
        const doFetch = (async () => {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
          }
          const payload = (await res.json()) as ApiResponse<T> | T;
          if (payload && typeof payload === 'object' && 'ok' in payload) {
            if (payload.ok === false) {
              throw new Error(payload.error?.message || 'Request failed');
            }
            const data = payload.data;
            const allowCache = shouldCache ? shouldCache(data) : true;
            if (allowCache) {
              responseCache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
            }
            return data as T;
          }
          const allowCache = shouldCache ? shouldCache(payload) : true;
          if (allowCache) {
            responseCache.set(cacheKey, { data: payload as T, expiresAt: Date.now() + ttlMs });
          }
          return payload as T;
        })();

        const result = abortPromise ? await Promise.race([doFetch, abortPromise]) : await doFetch;
        return result as T;
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          throw error;
        }
        if (attempt < retryCount && (didTimeout || (error as Error)?.name !== 'AbortError')) {
          attempt += 1;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
          continue;
        }
        throw error;
      } finally {
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
        if (timeout) {
          clearTimeout(timeout);
        }
      }
    }

    throw new Error('Request failed');
  })();

  inFlight.set(inFlightKey, request);
  request.finally(() => {
    if (inFlight.get(inFlightKey) === request) {
      inFlight.delete(inFlightKey);
    }
  });
  return request;
}

export async function apiFetchWithMeta<T>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<{ data: T; meta?: any }> {
  const {
    ttlMs = 30_000,
    cacheKey = url,
    signal,
    shouldCache,
    timeoutMs,
    retryCount = 0,
    retryDelayMs = 400,
    instanceId,
  } = options;

  const cached = responseCache.get(cacheKey);
  if (cached && isFresh(cached)) {
    return { data: cached.data as T, meta: { ...(cached.meta || {}), cached: true } };
  }

  const inFlightKey = signal
    ? `${cacheKey}:${instanceId ?? Math.random().toString(36).slice(2, 8)}`
    : cacheKey;

  const existing = inFlight.get(inFlightKey);
  if (existing) {
    return existing as Promise<{ data: T; meta?: any }>;
  }

  const request = (async () => {
    let attempt = 0;
    while (attempt <= retryCount) {
      let didTimeout = false;
      const controller = new AbortController();
      let abortPromise: Promise<never> | null = null;
      let abortHandler: (() => void) | null = null;

      if (signal) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        abortPromise = new Promise((_, reject) => {
          abortHandler = () => reject(new DOMException('Aborted', 'AbortError'));
          signal.addEventListener('abort', abortHandler, { once: true });
        });
      }

      const timeout = timeoutMs
        ? setTimeout(() => {
            didTimeout = true;
            controller.abort();
          }, timeoutMs)
        : null;

      try {
        const doFetch = (async () => {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
          }
          const payload = (await res.json()) as ApiResponse<T> | T;
          if (payload && typeof payload === 'object' && 'ok' in payload) {
            if (payload.ok === false) {
              throw new Error(payload.error?.message || 'Request failed');
            }
            const data = payload.data;
            const allowCache = shouldCache ? shouldCache(data) : true;
            if (allowCache) {
              responseCache.set(cacheKey, { data, meta: payload.meta, expiresAt: Date.now() + ttlMs });
            }
            return { data: data as T, meta: payload.meta };
          }
          const allowCache = shouldCache ? shouldCache(payload) : true;
          if (allowCache) {
            responseCache.set(cacheKey, { data: payload as T, expiresAt: Date.now() + ttlMs });
          }
          return { data: payload as T };
        })();

        const result = abortPromise ? await Promise.race([doFetch, abortPromise]) : await doFetch;
        return result as { data: T; meta?: any };
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          throw error;
        }
        if (attempt < retryCount && (didTimeout || (error as Error)?.name !== 'AbortError')) {
          attempt += 1;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
          continue;
        }
        throw error;
      } finally {
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
        if (timeout) {
          clearTimeout(timeout);
        }
      }
    }

    throw new Error('Request failed');
  })();

  inFlight.set(inFlightKey, request);
  request.finally(() => {
    if (inFlight.get(inFlightKey) === request) {
      inFlight.delete(inFlightKey);
    }
  });
  return request;
}
