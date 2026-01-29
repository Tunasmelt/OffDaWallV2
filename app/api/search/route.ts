import { NextRequest } from 'next/server';
import * as MusicBrainz from '@/lib/services/musicbrainz';
import { getFromCacheWithMeta, setCache } from '@/lib/cache';
import { normalizeImageUrl } from '@/lib/images';
import { resolveArtistImage } from '@/lib/services/image-resolver';
import { getArtistProfile } from '@/lib/services/aggregator';
import { logger } from '@/lib/logger';
import { respondOk, respondError } from '@/lib/api-response';
import { logEvent } from '@/lib/observability';
import { safeCall } from '@/lib/provider-safe';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const genre = searchParams.get('genre');
    const details = searchParams.get('details') === '1';
    
    if (!query || query.trim().length < 2) {
      return respondError(
        'invalid_query',
        'Query must be at least 2 characters',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        400
      );
    }

    logger.debug('[OffDaWallV2] Search query:', query, 'Genre filter:', genre || 'none', 'Details:', details);

    const cacheKey = `search:${query}:all:${details ? 'details' : 'basic'}`;
    const cached = getFromCacheWithMeta(cacheKey);
    
    if (cached.data) {
      logger.debug('[OffDaWallV2] Returning cached search results');
      const response = respondOk(
        cached.data,
        {
          payloadMode: 'preview',
          providersUsed: [],
          cache: { hit: true, stale: cached.stale },
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
      return response;
    }

    const providersUsed: string[] = [];
    // Search MusicBrainz (global search; ignore genre filtering)
    const searchResult = await safeCall('musicbrainz', () => MusicBrainz.searchArtists(query));
    const searchResults = searchResult.ok ? searchResult.data : [];
    if (searchResult.ok) providersUsed.push('musicbrainz');
    logger.debug('[OffDaWallV2] Found', searchResults.length, 'artists');

    const enhancedResults = await Promise.all(
      searchResults.slice(0, 5).map(async (artist, index) => {
        const resolved = await resolveArtistImage({ mbid: artist.mbid, name: artist.name });
        if (resolved.source && resolved.source !== 'none') {
          providersUsed.push(resolved.source);
        }
        const imageUrl = normalizeImageUrl(resolved.imageUrl || artist.image);

        if (details && index < 3) {
          const profileResult = await safeCall('aggregator', () => getArtistProfile(artist.mbid));
          const profile = profileResult.ok ? profileResult.data : null;
          if (profile) {
            if (!providersUsed.includes('aggregator')) {
              providersUsed.push('aggregator');
            }
            return {
              ...artist,
              ...profile,
              imageUrl: normalizeImageUrl(profile.imageUrl || imageUrl || artist.image),
              image: normalizeImageUrl(profile.image || imageUrl || artist.image),
            };
          }
        }

        return {
          ...artist,
          imageUrl,
          image: imageUrl || artist.image,
        };
      })
    );

    const allResults = [
      ...enhancedResults,
      ...searchResults.slice(5).map((artist) => {
        const imageUrl = normalizeImageUrl(artist.image);
        return {
          ...artist,
          imageUrl,
          image: imageUrl || artist.image,
        };
      }),
    ];

    const responsePayload = {
      query,
      genre: null,
      genreName: null,
      results: allResults,
      total: allResults.length,
    };

    // Cache for 1 hour when results exist
    if (allResults.length > 0) {
      setCache(cacheKey, responsePayload, 3600);
    }

    logEvent('info', '[OffDaWallV2] api/search', { success: true, query });
    const response = respondOk(
      responsePayload,
      {
        payloadMode: 'preview',
        providersUsed,
        cache: { hit: false },
      }
    );
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
    return response;
  } catch (error) {
    logger.error('[OffDaWallV2] Search error:', error);
    logEvent('error', '[OffDaWallV2] api/search', { success: false, error: `${error}` });
    return respondError(
      'search_failed',
      'Search failed',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}

