/**
 * API Monitoring and Performance Tracking
 * Monitors API health, rate limits, and performance metrics
 */

interface APIMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

interface RateLimitStatus {
  service: string;
  remaining: number;
  total: number;
  resetTime: number;
}

class APIMonitor {
  private metrics: APIMetrics[] = [];
  private rateLimits: Map<string, RateLimitStatus> = new Map();
  private maxMetricsSize = 1000;

  /**
   * Track an API call
   */
  trackAPICall(metrics: APIMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }

    // Log errors
    if (!metrics.success) {
      console.error('[OffDaWallV2] API Error:', {
        endpoint: metrics.endpoint,
        status: metrics.statusCode,
        error: metrics.error,
        duration: metrics.duration,
      });
    }

    // Warn on slow requests (>3s)
    if (metrics.duration > 3000) {
      console.warn('[OffDaWallV2] Slow API Request:', {
        endpoint: metrics.endpoint,
        duration: `${metrics.duration}ms`,
      });
    }
  }

  /**
   * Update rate limit status
   */
  updateRateLimit(service: string, status: RateLimitStatus): void {
    this.rateLimits.set(service, status);

    // Warn when approaching rate limit
    const percentUsed = ((status.total - status.remaining) / status.total) * 100;
    if (percentUsed > 80) {
      console.warn('[OffDaWallV2] Rate Limit Warning:', {
        service,
        remaining: status.remaining,
        total: status.total,
        percentUsed: `${percentUsed.toFixed(1)}%`,
      });
    }
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    totalCalls: number;
    successRate: number;
    averageDuration: number;
    errorRate: number;
    slowRequests: number;
  } {
    const total = this.metrics.length;
    const successful = this.metrics.filter(m => m.success).length;
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / total || 0;
    const slowRequests = this.metrics.filter(m => m.duration > 3000).length;

    return {
      totalCalls: total,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageDuration: Math.round(avgDuration),
      errorRate: total > 0 ? ((total - successful) / total) * 100 : 0,
      slowRequests,
    };
  }

  /**
   * Get rate limit status for all services
   */
  getRateLimitStatus(): RateLimitStatus[] {
    return Array.from(this.rateLimits.values());
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): APIMetrics[] {
    return this.metrics
      .filter(m => !m.success)
      .slice(-limit)
      .reverse();
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

// Singleton instance
export const apiMonitor = new APIMonitor();

/**
 * Helper to track API calls with timing
 */
export async function trackAPICall<T>(
  endpoint: string,
  method: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let statusCode = 200;
  let error: string | undefined;

  try {
    const result = await apiCall();
    return result;
  } catch (err) {
    success = false;
    statusCode = 500;
    error = err instanceof Error ? err.message : 'Unknown error';
    throw err;
  } finally {
    const duration = Date.now() - startTime;
    apiMonitor.trackAPICall({
      endpoint,
      method,
      statusCode,
      duration,
      timestamp: startTime,
      success,
      error,
    });
  }
}

