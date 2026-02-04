import { NextRequest } from 'next/server';
import * as MusicBrainz from '@/lib/services/musicbrainz';
import { getFromCacheWithMeta, setCache } from '@/lib/cache';
import { normalizeImageUrl, toImageProxyUrl } from '@/lib/images';
import { resolveArtistImage } from '@/lib/services/image-resolver';
import { getAllGenres } from '@/lib/genres';
import * as Deezer from '@/lib/services/deezer';
import * as Spotify from '@/lib/services/spotify';
import { logger } from '@/lib/logger';
import { respondOk, respondError } from '@/lib/api-response';
import { addProviderTiming, logRouteResult, routeMeta, startRouteTrace } from '@/lib/observability';
import { safeCall } from '@/lib/provider-safe';
import { isValidUuid } from '@/lib/ids';

const SEARCH_ENRICHMENT_WORKERS = 3;
const normalizeName = (value?: string | null) =>
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function GET(request: NextRequest) {
  const trace = startRouteTrace('api/search');
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const type = (searchParams.get('type') || 'artists').toLowerCase();
    const limit = Math.min(Number(searchParams.get('limit') || 20), 50);
    
    if (!query || query.trim().length < 2) {
      return respondError(
        'invalid_query',
        'Query must be at least 2 characters',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false }, ...routeMeta(trace) },
        400
      );
    }

    logger.debug('[OffDaWallV2] Search query:', query, 'Type:', type);

    const cacheKey = `search:${query}:${type}:${limit}`;
    const cached = getFromCacheWithMeta(cacheKey);
    
    if (cached.data) {
      logger.debug('[OffDaWallV2] Returning cached search results');
      const cachedPayload = cached.data as { artists?: unknown[]; genres?: unknown[] };
      const hasCachedResults =
        (cachedPayload.artists?.length || 0) > 0 || (cachedPayload.genres?.length || 0) > 0;
      const response = respondOk(
        cached.data,
        {
          payloadMode: 'preview',
          providersUsed: [],
          cache: { hit: true, stale: cached.stale },
          status: hasCachedResults ? 'ok' : 'empty',
          emptyReason: hasCachedResults ? undefined : 'no_results',
          ...routeMeta(trace),
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
      return response;
    }

    const providersUsed: string[] = [];
    let artists: any[] = [];
    let genres: any[] = [];

    if (type === 'artists' || type === 'all') {
      const mbStart = Date.now();
      const searchResult = await safeCall('musicbrainz', () => MusicBrainz.searchArtists(query));
      addProviderTiming(trace, 'musicbrainz', Date.now() - mbStart);
      const searchResults = searchResult.ok ? searchResult.data : [];
      if (searchResult.ok) providersUsed.push('musicbrainz');
      logger.debug('[OffDaWallV2] Found', searchResults.length, 'artists');

      let spotifyQueryArtist = null as any;
      if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
        const spStart = Date.now();
        const spotifyQueryResult = await safeCall('spotify', () => Spotify.searchArtistByName(query));
        addProviderTiming(trace, 'spotify', Date.now() - spStart);
        spotifyQueryArtist = spotifyQueryResult.ok ? spotifyQueryResult.data : null;
        if (spotifyQueryArtist && !providersUsed.includes('spotify')) {
          providersUsed.push('spotify');
        }
      }

      const candidates = searchResults.slice(0, Math.min(8, limit));
      const normalizedQuery = normalizeName(query);
      const normalizedSpotifyName = normalizeName(spotifyQueryArtist?.name);
      const enhancedResults = await mapWithConcurrency(
        candidates,
        SEARCH_ENRICHMENT_WORKERS,
        async (artist, candidateIndex) => {
          const resolved = await resolveArtistImage({ mbid: artist.mbid, name: artist.name });
          if (resolved.source && resolved.source !== 'none' && !providersUsed.includes(resolved.source)) {
            providersUsed.push(resolved.source);
          }
          let imageUrl = normalizeImageUrl(resolved.imageUrl || artist.image);
          let genres = artist.genres || [];
          let popularity = artist.popularity;

          // Apply one-shot query-level Spotify enrichment only to the top candidate.
          // This avoids misattributing the same Spotify artist image to all same-name results.
          if (
            candidateIndex === 0 &&
            spotifyQueryArtist &&
            normalizedSpotifyName &&
            normalizeName(artist.name) === normalizedSpotifyName &&
            (normalizedQuery === normalizedSpotifyName || normalizedQuery === normalizeName(artist.name))
          ) {
            if (!imageUrl) {
              imageUrl = normalizeImageUrl(Spotify.extractArtistImage(spotifyQueryArtist)) || imageUrl;
            }
            if (!genres.length) {
              const spotifyGenres = Spotify.extractArtistGenres(spotifyQueryArtist);
              if (spotifyGenres.length) {
                genres = spotifyGenres;
              }
            }
            if (!popularity) {
              popularity = Spotify.extractArtistPopularity(spotifyQueryArtist);
            }
          }
          if (!imageUrl) {
            const dzStart = Date.now();
            const deezerResult = await safeCall('deezer', () => Deezer.searchArtist(artist.name));
            addProviderTiming(trace, 'deezer', Date.now() - dzStart);
            const deezerArtist = deezerResult.ok ? deezerResult.data : null;
            if (deezerArtist && !providersUsed.includes('deezer')) {
              providersUsed.push('deezer');
            }
            imageUrl = normalizeImageUrl(deezerArtist?.picture_big || deezerArtist?.picture_medium) || imageUrl;
          }
          return {
            ...artist,
            mbid: isValidUuid(artist.mbid || '') ? artist.mbid : '',
            imageUrl: toImageProxyUrl(imageUrl) || imageUrl,
            image: toImageProxyUrl(imageUrl) || imageUrl || artist.image,
            genres,
            popularity,
          };
        }
      );

      artists = [
        ...enhancedResults,
        ...searchResults.slice(enhancedResults.length, limit).map((artist) => {
          const imageUrl = normalizeImageUrl(artist.image);
          const proxied = toImageProxyUrl(imageUrl) || imageUrl;
          return {
            ...artist,
            mbid: isValidUuid(artist.mbid || '') ? artist.mbid : '',
            imageUrl: proxied,
            image: proxied || artist.image,
          };
        }),
      ].slice(0, limit);

      // De-duplicate by MBID first, then by normalized name + area.
      const seen = new Set<string>();
      artists = artists.filter((artist) => {
        const key = isValidUuid(artist.mbid || '')
          ? `mbid:${artist.mbid.toLowerCase()}`
          : `name:${normalizeName(artist.name)}|area:${normalizeName(artist.area)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (type === 'genres' || type === 'all') {
      const allGenres = getAllGenres();
      const q = query.toLowerCase();
      genres = allGenres.filter(
        (genre) =>
          genre.name.toLowerCase().includes(q) ||
          genre.slug.toLowerCase().includes(q)
      );
    }

    const responsePayload = {
      q: query,
      artists,
      genres,
    };

    // Cache for 1 hour when results exist
    if (artists.length > 0 || genres.length > 0) {
      setCache(cacheKey, responsePayload, 3600);
    }

    logRouteResult('info', trace, {
      success: true,
      query,
      status: artists.length === 0 && genres.length === 0 ? 'empty' : 'ok',
      emptyReason: artists.length === 0 && genres.length === 0 ? 'no_results' : undefined,
    });
    const response = respondOk(
      responsePayload,
      {
        payloadMode: 'preview',
        providersUsed,
        cache: { hit: false },
        status: artists.length === 0 && genres.length === 0 ? 'empty' : 'ok',
        emptyReason: artists.length === 0 && genres.length === 0 ? 'no_results' : undefined,
        ...routeMeta(trace),
      }
    );
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
    return response;
  } catch (error) {
    logger.error('[OffDaWallV2] Search error:', error);
    logRouteResult('error', trace, { success: false, error: `${error}` });
    return respondError(
      'search_failed',
      'Search failed',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false }, ...routeMeta(trace) },
      500
    );
  }
}

