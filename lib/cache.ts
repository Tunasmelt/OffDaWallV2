import type { CacheEntry } from './types';

// In-memory cache with TTL support
class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if cache entry has expired
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
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

export function setCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, data, ttl);
}

// Run cleanup every hour
if (typeof window === 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 60 * 60 * 1000);
}
