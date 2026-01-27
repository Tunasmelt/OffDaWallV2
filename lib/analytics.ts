'use client';

/**
 * Analytics tracking for OffDaWall
 * Tracks user interactions, genre popularity, and artist views
 */

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: number;
}

class Analytics {
  private events: AnalyticsEvent[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Track a page view
   */
  trackPageView(page: string, properties?: Record<string, any>) {
    this.track('page_view', {
      page,
      ...properties,
    });
  }

  /**
   * Track genre exploration
   */
  trackGenreView(genreName: string, genreSlug: string) {
    this.track('genre_view', {
      genre_name: genreName,
      genre_slug: genreSlug,
    });
  }

  /**
   * Track artist profile views
   */
  trackArtistView(artistName: string, artistMbid: string) {
    this.track('artist_view', {
      artist_name: artistName,
      artist_mbid: artistMbid,
    });
  }

  /**
   * Track search queries
   */
  trackSearch(query: string, resultsCount: number) {
    this.track('search', {
      query,
      results_count: resultsCount,
    });
  }

  /**
   * Track audio playback
   */
  trackAudioPlay(trackTitle: string, artistName: string, source: 'catalog' | 'recommendations') {
    this.track('audio_play', {
      track_title: trackTitle,
      artist_name: artistName,
      source,
    });
  }

  /**
   * Track recommendation interactions
   */
  trackRecommendationView(artistName: string, category: string) {
    this.track('recommendation_view', {
      artist_name: artistName,
      category,
    });
  }

  /**
   * Track errors
   */
  trackError(errorType: string, errorMessage: string, context?: Record<string, any>) {
    this.track('error', {
      error_type: errorType,
      error_message: errorMessage,
      ...context,
    });
  }

  /**
   * Base tracking method
   */
  private track(event: string, properties?: Record<string, any>) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        session_id: this.sessionId,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    this.events.push(analyticsEvent);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, properties);
    }

    // Send to analytics endpoint (optional)
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true') {
      this.sendToEndpoint(analyticsEvent);
    }

    // Store locally for admin dashboard
    this.storeLocally(analyticsEvent);
  }

  /**
   * Send event to analytics endpoint
   */
  private async sendToEndpoint(event: AnalyticsEvent) {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('[Analytics] Failed to send event:', error);
    }
  }

  /**
   * Store event locally for dashboard
   */
  private storeLocally(event: AnalyticsEvent) {
    if (typeof window === 'undefined') return;

    const key = 'offdawall_analytics';
    const stored = localStorage.getItem(key);
    const events = stored ? JSON.parse(stored) : [];
    
    // Keep only last 100 events
    events.push(event);
    if (events.length > 100) {
      events.shift();
    }

    localStorage.setItem(key, JSON.stringify(events));
  }

  /**
   * Get stored events (for dashboard)
   */
  getEvents(): AnalyticsEvent[] {
    return this.events;
  }

  /**
   * Clear events
   */
  clearEvents() {
    this.events = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('offdawall_analytics');
    }
  }
}

// Singleton instance
export const analytics = new Analytics();

// Hook for React components
export function useAnalytics() {
  return analytics;
}
