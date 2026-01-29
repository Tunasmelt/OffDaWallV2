import type { CacheEntry } from './types';

// In-memory cache with TTL support
class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  set<T>(key: string, data: T, ttl: number, staleTtl: number = ttl * 3): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      staleUntil: Date.now() + ttl + staleTtl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      return null;
    }

    return entry.data as T;
  }

  getWithMeta<T>(key: string): { data: T | null; hit: boolean; stale: boolean } {
    const entry = this.cache.get(key);
    if (!entry) {
      return { data: null, hit: false, stale: false };
    }

    const now = Date.now();
    const age = now - entry.timestamp;
    const staleUntil = entry.staleUntil ?? entry.timestamp + entry.ttl * 4;

    if (age <= entry.ttl) {
      return { data: entry.data as T, hit: true, stale: false };
    }

    if (now <= staleUntil) {
      return { data: entry.data as T, hit: true, stale: true };
    }

    this.cache.delete(key);
    return { data: null, hit: false, stale: false };
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl && Date.now() > (entry.staleUntil ?? entry.timestamp + entry.ttl * 4)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton cache instance
export const cache = new MemoryCache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  ARTIST_DATA: 24 * 60 * 60 * 1000, // 24 hours
  GENRE_DATA: 24 * 60 * 60 * 1000, // 24 hours
  IMAGES: 7 * 24 * 60 * 60 * 1000, // 7 days
  CATALOG: 24 * 60 * 60 * 1000, // 24 hours
  RECOMMENDATIONS: 12 * 60 * 60 * 1000, // 12 hours
  SEARCH: 1 * 60 * 60 * 1000, // 1 hour
} as const;

// Helper functions for easier cache access
export function getFromCache<T>(key: string): T | null {
  return cache.get<T>(key);
}

export function getFromCacheWithMeta<T>(key: string) {
  return cache.getWithMeta<T>(key);
}

export function setCache<T>(key: string, data: T, ttl: number, staleTtl?: number): void {
  cache.set(key, data, ttl, staleTtl);
}

// Run cleanup every hour
if (typeof window === 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 60 * 60 * 1000);
}
