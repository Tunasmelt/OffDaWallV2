// Rate limiting utility for API calls

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  maxWaitMs?: number; // Optional cap on wait time to avoid long hangs
}

export interface RateLimitStatus {
  maxRequests: number;
  windowMs: number;
  maxWaitMs?: number;
  requestsInWindow: number;
  waitMs: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async waitForSlot(key: string = 'default'): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this key
    let timestamps = this.requests.get(key) || [];

    // Remove timestamps outside the current window
    timestamps = timestamps.filter(ts => ts > windowStart);

    // Check if we're at the limit
    if (timestamps.length >= this.config.maxRequests) {
      // Calculate how long to wait
      const oldestInWindow = timestamps[0];
      const waitTime = oldestInWindow + this.config.windowMs - now + 100; // +100ms buffer

      if (this.config.maxWaitMs !== undefined && waitTime > this.config.maxWaitMs) {
        throw new Error(`Rate limiter wait exceeded ${this.config.maxWaitMs}ms`);
      }

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.waitForSlot(key); // Retry after waiting
      }
    }

    // Add current timestamp
    timestamps.push(now);
    this.requests.set(key, timestamps);
  }

  getStatus(key: string = 'default'): RateLimitStatus {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    let timestamps = this.requests.get(key) || [];

    timestamps = timestamps.filter(ts => ts > windowStart);
    this.requests.set(key, timestamps);

    let waitMs = 0;
    if (timestamps.length >= this.config.maxRequests) {
      const oldestInWindow = timestamps[0];
      waitMs = Math.max(oldestInWindow + this.config.windowMs - now + 100, 0);
    }

    return {
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
      maxWaitMs: this.config.maxWaitMs,
      requestsInWindow: timestamps.length,
      waitMs,
    };
  }

  reset(key: string = 'default'): void {
    this.requests.delete(key);
  }

  resetAll(): void {
    this.requests.clear();
  }
}

// Rate limiter instances for different APIs
export const musicBrainzLimiter = new RateLimiter({
  maxRequests: 1,
  windowMs: 1000, // 1 request per second
});

export const audioDBLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 24 * 60 * 60 * 1000, // 100 requests per day
  maxWaitMs: 5000,
});

export const deezerLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 requests per minute (conservative)
  maxWaitMs: 2000,
});

// Generic rate limiter factory
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}
