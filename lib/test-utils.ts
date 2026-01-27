/**
 * Testing Utilities
 * Helper functions for testing API fallbacks and system reliability
 */

import { errorLogger, ErrorSeverity } from './error-logger';

/**
 * Test API fallback chain
 */
export async function testAPIFallback<T>(
  primaryAPI: () => Promise<T>,
  fallbackAPI: () => Promise<T>,
  cacheFallback: () => T | null,
  apiName: string
): Promise<{ success: boolean; source: 'primary' | 'fallback' | 'cache' | 'failed'; data: T | null }> {
  console.log(`[OffDaWallV2] Testing ${apiName} fallback chain...`);

  // Try primary API
  try {
    const data = await primaryAPI();
    console.log(`[OffDaWallV2] ${apiName} - Primary API succeeded`);
    return { success: true, source: 'primary', data };
  } catch (primaryError) {
    console.warn(`[OffDaWallV2] ${apiName} - Primary API failed:`, primaryError);
    errorLogger.logAPIError(apiName, primaryError as Error, undefined, { stage: 'primary' });

    // Try fallback API
    try {
      const data = await fallbackAPI();
      console.log(`[OffDaWallV2] ${apiName} - Fallback API succeeded`);
      return { success: true, source: 'fallback', data };
    } catch (fallbackError) {
      console.warn(`[OffDaWallV2] ${apiName} - Fallback API failed:`, fallbackError);
      errorLogger.logAPIError(apiName, fallbackError as Error, undefined, { stage: 'fallback' });

      // Try cache
      const cachedData = cacheFallback();
      if (cachedData) {
        console.log(`[OffDaWallV2] ${apiName} - Cache fallback succeeded`);
        return { success: true, source: 'cache', data: cachedData };
      }

      console.error(`[OffDaWallV2] ${apiName} - All fallbacks failed`);
      errorLogger.log(`${apiName} - Complete fallback chain failure`, ErrorSeverity.HIGH, {
        primaryError: (primaryError as Error).message,
        fallbackError: (fallbackError as Error).message,
      });
      return { success: false, source: 'failed', data: null };
    }
  }
}

/**
 * Test rate limiter
 */
export async function testRateLimiter(
  apiCall: () => Promise<void>,
  maxRequests: number,
  timeWindowMs: number
): Promise<{ passed: boolean; actualRequests: number; blockedRequests: number }> {
  console.log(`[OffDaWallV2] Testing rate limiter: ${maxRequests} requests in ${timeWindowMs}ms`);

  let successful = 0;
  let blocked = 0;

  const promises = Array.from({ length: maxRequests + 5 }).map(async () => {
    try {
      await apiCall();
      successful++;
    } catch (error) {
      blocked++;
    }
  });

  await Promise.allSettled(promises);

  const passed = blocked >= 5; // At least 5 should be blocked
  console.log(`[OffDaWallV2] Rate limiter test: ${passed ? 'PASSED' : 'FAILED'} (${successful} successful, ${blocked} blocked)`);

  return { passed, actualRequests: successful, blockedRequests: blocked };
}

/**
 * Test cache TTL
 */
export async function testCacheTTL(
  cacheKey: string,
  setCache: (key: string, value: unknown, ttl: number) => void,
  getCache: (key: string) => unknown | null,
  ttlMs: number
): Promise<boolean> {
  console.log(`[OffDaWallV2] Testing cache TTL for key: ${cacheKey}`);

  const testValue = { test: 'data', timestamp: Date.now() };

  // Set cache
  setCache(cacheKey, testValue, ttlMs);

  // Immediate retrieval should work
  const immediate = getCache(cacheKey);
  if (!immediate) {
    console.error('[OffDaWallV2] Cache TTL test FAILED: Immediate retrieval failed');
    return false;
  }

  // Wait for half TTL
  await new Promise(resolve => setTimeout(resolve, ttlMs / 2));
  const midway = getCache(cacheKey);
  if (!midway) {
    console.error('[OffDaWallV2] Cache TTL test FAILED: Midway retrieval failed');
    return false;
  }

  // Wait for TTL to expire
  await new Promise(resolve => setTimeout(resolve, ttlMs / 2 + 100));
  const expired = getCache(cacheKey);
  if (expired) {
    console.error('[OffDaWallV2] Cache TTL test FAILED: Cache did not expire');
    return false;
  }

  console.log('[OffDaWallV2] Cache TTL test PASSED');
  return true;
}

/**
 * Test image loading with slow connection
 */
export function testImageLoading(imageUrl: string): Promise<{ success: boolean; loadTime: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const img = new Image();

    img.onload = () => {
      const loadTime = Date.now() - startTime;
      console.log(`[OffDaWallV2] Image loaded successfully in ${loadTime}ms:`, imageUrl);
      resolve({ success: true, loadTime });
    };

    img.onerror = () => {
      const loadTime = Date.now() - startTime;
      console.error(`[OffDaWallV2] Image failed to load after ${loadTime}ms:`, imageUrl);
      resolve({ success: false, loadTime });
    };

    img.src = imageUrl;
  });
}

/**
 * Validate genre classification
 */
export function validateGenreClassification(
  artistTags: string[],
  expectedGenre: string,
  genreTagMappings: string[]
): boolean {
  const hasMatchingTag = artistTags.some(tag => 
    genreTagMappings.some(mapping => 
      tag.toLowerCase().includes(mapping.toLowerCase())
    )
  );

  if (!hasMatchingTag) {
    console.warn(`[OffDaWallV2] Genre classification mismatch for ${expectedGenre}:`, {
      artistTags,
      expectedMappings: genreTagMappings,
    });
  }

  return hasMatchingTag;
}

/**
 * Run system health check
 */
export async function runHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
}> {
  console.log('[OffDaWallV2] Running system health check...');

  const checks: Record<string, boolean> = {};

  // Test APIs
  try {
    const healthResponse = await fetch('/api/health');
    checks.healthEndpoint = healthResponse.ok;
  } catch {
    checks.healthEndpoint = false;
  }

  try {
    const genresResponse = await fetch('/api/genres');
    checks.genresEndpoint = genresResponse.ok;
  } catch {
    checks.genresEndpoint = false;
  }

  // Determine overall status
  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const passRate = passedChecks / totalChecks;

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (passRate === 1) {
    status = 'healthy';
  } else if (passRate >= 0.5) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  console.log(`[OffDaWallV2] Health check complete: ${status} (${passedChecks}/${totalChecks} passed)`);

  return { status, checks };
}

