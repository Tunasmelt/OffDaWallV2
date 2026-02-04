import { getGenreBySlug } from '@/lib/genres';
import { getArtistsForGenre } from '@/lib/services/aggregator';
import { CACHE_TTL, getFromCacheWithMeta, setCache } from '@/lib/cache';
import { normalizeImageUrl, toImageProxyUrl } from '@/lib/images';
import { logger } from '@/lib/logger';
import { respondOk, respondError } from '@/lib/api-response';
import { isDebugMode, logEvent } from '@/lib/observability';
import { safeCall } from '@/lib/provider-safe';
import { isLikelyArtistType, isValidUuid } from '@/lib/ids';
import type { Artist } from '@/lib/types';
import * as Spotify from '@/lib/services/spotify';

// Calculate popularity score based on available data
function calculatePopularityScore(artist: Artist): number {
  let score = 0;
  
  // Listener count is the primary factor (normalized to 0-100)
  if (artist.listeners) {
    score += Math.min(artist.listeners / 100000, 100) * 0.7;
  }
  
  // Tags/genres indicate recognition
  if (artist.tags && artist.tags.length > 0) {
    score += Math.min(artist.tags.length * 2, 20);
  }
  
  // Having complete data (bio, images) indicates established artist
  if (artist.bio) score += 5;
  if (artist.imageUrl) score += 5;
  
  return score;
}

// Categorize artists into top and upcoming
function categorizeArtists(artists: Artist[]) {
  // Calculate popularity scores
  const artistsWithScores = artists.map(artist => ({
    ...artist,
    popularityScore: calculatePopularityScore(artist),
  }));
  
  // Sort by popularity
  artistsWithScores.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
  
  // Calculate percentile thresholds
  const scores = artistsWithScores.map(a => a.popularityScore || 0);
  const p80 = scores[Math.floor(scores.length * 0.2)] || 50; // Top 20%
  const p50 = scores[Math.floor(scores.length * 0.5)] || 25; // 50th percentile
  
  const topArtists = artistsWithScores.filter(a => (a.popularityScore || 0) >= p80);
  const upcomingArtists = artistsWithScores.filter(a => {
    const score = a.popularityScore || 0;
    return score >= p50 && score < p80;
  });
  
  return {
    topArtists: topArtists.slice(0, 20),
    upcomingArtists: upcomingArtists.slice(0, 20),
    totalCount: artistsWithScores.length,
  };
}

function normalizeArtistImages(artists: Artist[]) {
  artists.forEach((artist) => {
    const normalized = normalizeImageUrl(artist.imageUrl || artist.image);
    if (normalized) {
      artist.imageUrl = normalized;
      artist.image = normalized;
    }
  });
}

async function enrichTopArtistImagesFast(artists: Artist[], providersUsed: string[]) {
  if (!artists.length) return;
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) return;

  const targets = artists.filter((artist) => !normalizeImageUrl(artist.imageUrl || artist.image));
  if (!targets.length) return;

  const workers = 3;
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const idx = cursor++;
      const artist = targets[idx];
      const spotifyResult = await safeCall('spotify', () => Spotify.searchArtistByName(artist.name));
      if (!spotifyResult.ok || !spotifyResult.data) continue;

      const spotifyImage = normalizeImageUrl(Spotify.extractArtistImage(spotifyResult.data));
      if (!spotifyImage) continue;
      const proxied = toImageProxyUrl(spotifyImage) || spotifyImage;
      artist.imageUrl = proxied;
      artist.image = proxied;
      if (!providersUsed.includes('spotify')) {
        providersUsed.push('spotify');
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(workers, targets.length) }, () => worker()));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === '1';
    const cacheKey = `genre:${slug}:${isPreview ? 'preview' : 'full'}`;
    const providersUsed: string[] = [];

    // Get genre info
    const genre = getGenreBySlug(slug);
    
    if (!genre) {
      return respondError(
        'genre_not_found',
        'Genre not found',
        { payloadMode: isPreview ? 'preview' : 'deep', providersUsed, cache: { hit: false } },
        404
      );
    }

    const cached = getFromCacheWithMeta<any>(cacheKey);
    if (cached.data) {
      const response = respondOk(
        cached.data,
        {
          payloadMode: isPreview ? 'preview' : 'deep',
          providersUsed,
          cache: { hit: true, stale: cached.stale },
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
      return response;
    }
    
    // Fetch artists for this genre
    const artistsResult = await safeCall('musicbrainz', () =>
      getArtistsForGenre(genre.tags, isPreview ? 15 : 50)
    );
    const artists = artistsResult.ok ? artistsResult.data : [];
    if (artistsResult.ok) {
      providersUsed.push('musicbrainz');
    }

    const beforeCount = artists.length;
    const filteredArtists = artists.filter((artist) => {
      if (!isValidUuid(artist.mbid)) {
        return false;
      }
      if (!isLikelyArtistType(artist.type)) {
        return false;
      }
      return true;
    });

    if (isDebugMode() && beforeCount !== filteredArtists.length) {
      logEvent('info', '[OffDaWallV2] api/genres/[slug] filtered artists', {
        slug,
        before: beforeCount,
        after: filteredArtists.length,
      });
    }
    
    if (filteredArtists.length === 0) {
      const emptyPayload = {
        genre,
        topArtists: [],
        upcomingArtists: [],
        totalCount: 0,
        message: 'No artists found for this genre',
      };
      setCache(cacheKey, emptyPayload, CACHE_TTL.GENRE_DATA);
      const response = respondOk(
        emptyPayload,
        {
          payloadMode: isPreview ? 'preview' : 'deep',
          providersUsed,
          cache: { hit: false },
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
      return response;
    }
    
    // Categorize artists
    const { topArtists, upcomingArtists, totalCount } = categorizeArtists(filteredArtists);
    const topSelection = isPreview ? topArtists.slice(0, 6) : topArtists;
    const upcomingSelection = isPreview ? upcomingArtists.slice(0, 4) : upcomingArtists;

    // Keep cold-start fast: enrich a tiny above-the-fold subset only.
    const eagerSelection = [...topSelection.slice(0, 6), ...upcomingSelection.slice(0, 2)];
    await enrichTopArtistImagesFast(eagerSelection, providersUsed);

    normalizeArtistImages(topSelection);
    normalizeArtistImages(upcomingSelection);
    
    const payload = {
      genre,
      topArtists: topSelection,
      upcomingArtists: upcomingSelection,
      totalCount,
      cached: false,
      timestamp: Date.now(),
    };
    setCache(cacheKey, payload, CACHE_TTL.GENRE_DATA);
    logEvent('info', '[OffDaWallV2] api/genres/[slug]', { success: true, slug });
    const response = respondOk(
      payload,
      {
        payloadMode: isPreview ? 'preview' : 'deep',
        providersUsed,
        cache: { hit: false },
      }
    );
    response.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return response;
    
  } catch (error) {
    logger.error('[OffDaWallV2] Genre API error:', error);
    logEvent('error', '[OffDaWallV2] api/genres/[slug]', { success: false, error: `${error}` });
    return respondError(
      'genre_failed',
      'Failed to fetch genre data',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}

