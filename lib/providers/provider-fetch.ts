import { GLOBAL_LIMITS, PROVIDER_LIMITS, ProviderName } from './provider-limits';

type ProviderFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type ProviderFetchMeta = {
  provider: ProviderName;
  status: number;
  durationMs: number;
  rateLimited: boolean;
  retries: number;
};

class Limiter {
  private active = 0;
  private lastStart = 0;
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    signal?: AbortSignal;
  }> = [];

  constructor(private readonly minIntervalMs: number, private readonly concurrency: number) {}

  acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, signal };
      if (signal) {
        const abortHandler = () => {
          this.queue = this.queue.filter((item) => item !== entry);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', abortHandler, { once: true });
      }
      this.queue.push(entry);
      this.run();
    });
  }

  release() {
    this.active = Math.max(0, this.active - 1);
    this.run();
  }

  getStatus() {
    const elapsed = Date.now() - this.lastStart;
    const waitMs = Math.max(this.minIntervalMs - elapsed, 0);
    return {
      active: this.active,
      queueLength: this.queue.length,
      requestsInWindow: this.active + this.queue.length,
      waitMs,
      minIntervalMs: this.minIntervalMs,
      concurrency: this.concurrency,
      lastStart: this.lastStart,
    };
  }

  private run() {
    if (this.active >= this.concurrency) return;
    if (this.queue.length === 0) return;

    const now = Date.now();
    const elapsed = now - this.lastStart;
    const waitMs = Math.max(this.minIntervalMs - elapsed, 0);

    if (waitMs > 0) {
      setTimeout(() => this.run(), waitMs);
      return;
    }

    const next = this.queue.shift();
    if (!next) return;
    if (next.signal?.aborted) {
      next.reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    this.active += 1;
    this.lastStart = Date.now();
    next.resolve();
  }
}

const globalLimiter = new Limiter(0, GLOBAL_LIMITS.concurrency);
const providerLimiters = new Map<ProviderName, Limiter>();

function getLimiter(provider: ProviderName) {
  let limiter = providerLimiters.get(provider);
  if (!limiter) {
    const limit = PROVIDER_LIMITS[provider];
    limiter = new Limiter(limit.minIntervalMs, limit.concurrency);
    providerLimiters.set(provider, limiter);
  }
  return limiter;
}

export function getProviderLimiterStatus(provider: ProviderName) {
  return getLimiter(provider).getStatus();
}

function getRetryAfterMs(res: Response): number | null {
  const retryAfter = res.headers.get('retry-after');
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds)) {
    return Math.max(seconds * 1000, 0);
  }
  const date = Date.parse(retryAfter);
  if (!Number.isNaN(date)) {
    return Math.max(date - Date.now(), 0);
  }
  return null;
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function providerFetch(
  provider: ProviderName,
  url: string,
  options: ProviderFetchOptions = {}
): Promise<{ response: Response; meta: ProviderFetchMeta }> {
  const { method = 'GET', headers = {}, signal, timeoutMs = 4500 } = options;
  const limiter = getLimiter(provider);
  let retries = 0;
  let attempt = 0;
  let lastStatus = 0;
  const max429Retries = 2;
  const max503Retries = provider === 'musicbrainz' ? 1 : 0;

  while (true) {
    await globalLimiter.acquire(signal);
    await limiter.acquire(signal);
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const reqHeaders: Record<string, string> = { ...headers };
      if (provider === 'musicbrainz' && !reqHeaders['User-Agent']) {
        reqHeaders['User-Agent'] = 'OffDaWall/1.0.0 (https://offdawall.app)';
      }
      if (!reqHeaders['Accept']) {
        reqHeaders['Accept'] = 'application/json';
      }

      const res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: options.body,
        signal: controller.signal,
      });
      lastStatus = res.status;

      if (res.status === 429 && retries < max429Retries) {
        retries += 1;
        attempt += 1;
        const retryAfter = getRetryAfterMs(res);
        const backoff = retryAfter ?? Math.min(500 * 2 ** (attempt - 1), 2000);
        await sleep(backoff);
        continue;
      }

      if (res.status === 503 && retries < max503Retries) {
        retries += 1;
        attempt += 1;
        await sleep(Math.min(500 * 2 ** (attempt - 1), 2000));
        continue;
      }

      const meta: ProviderFetchMeta = {
        provider,
        status: res.status,
        durationMs: Date.now() - start,
        rateLimited: res.status === 429,
        retries,
      };
      if (process.env.DEBUG_PROVIDERS === '1') {
        console.log('[providerFetch]', meta);
      }
      return { response: res, meta };
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        throw error;
      }
      if (attempt < max429Retries) {
        attempt += 1;
        retries += 1;
        await sleep(Math.min(500 * 2 ** (attempt - 1), 2000));
        continue;
      }
      const meta: ProviderFetchMeta = {
        provider,
        status: lastStatus,
        durationMs: Date.now() - start,
        rateLimited: false,
        retries,
      };
      if (process.env.DEBUG_PROVIDERS === '1') {
        console.log('[providerFetch]', meta);
      }
      throw Object.assign(error as Error, { meta });
    } finally {
      clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      limiter.release();
      globalLimiter.release();
    }
  }
}

export async function providerFetchJson<T>(
  provider: ProviderName,
  url: string,
  options: ProviderFetchOptions = {}
): Promise<{ data: T; meta: ProviderFetchMeta; status: number; headers: Headers }> {
  const { response, meta } = await providerFetch(provider, url, options);
  const status = response.status;
  if (!response.ok) {
    const error = new Error(`HTTP ${status}`);
    (error as any).meta = meta;
    throw error;
  }
  const data = (await response.json()) as T;
  return { data, meta, status, headers: response.headers };
}
