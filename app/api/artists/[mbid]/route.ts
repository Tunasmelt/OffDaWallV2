import { NextRequest } from 'next/server';
import { getArtistProfile } from '@/lib/services/aggregator';
import * as MusicBrainz from '@/lib/services/musicbrainz';
import * as Spotify from '@/lib/services/spotify';
import { normalizeImageUrl } from '@/lib/images';
import { logger } from '@/lib/logger';
import { respondOk, respondError } from '@/lib/api-response';
import { addProviderTiming, logRouteResult, routeMeta, startRouteTrace } from '@/lib/observability';
import { safeCall } from '@/lib/provider-safe';
import { withTimeBudget } from '@/lib/services/fast-path';
import type { Artist } from '@/lib/types';
import { isValidUuid } from '@/lib/ids';

function isTransientMusicBrainzError(code?: string, message?: string) {
  const normalizedCode = (code || '').toLowerCase();
  const normalizedMessage = (message || '').toLowerCase();
  return (
    normalizedCode === 'aborterror' ||
    normalizedCode === 'timeouterror' ||
    normalizedCode === 'provider_error' ||
    normalizedCode === 'fetcherror' ||
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('aborted') ||
    normalizedMessage.includes('503') ||
    normalizedMessage.includes('429')
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const trace = startRouteTrace('api/artists/[mbid]');
  try {
    const { mbid } = await params;
    const decodedMbid = decodeURIComponent(mbid || '').trim();

    if (!decodedMbid) {
      return respondError(
        'missing_mbid',
        'Artist MBID is required',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false }, ...routeMeta(trace) },
        400
      );
    }
    if (!isValidUuid(decodedMbid)) {
      return respondError(
        'bad_artist_id',
        'Artist MBID is invalid',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false }, ...routeMeta(trace) },
        400
      );
    }

    logger.debug('[OffDaWallV2] Fetching artist profile for MBID:', decodedMbid);

    const providersUsed: string[] = [];
    const fallbackUsed: string[] = [];

    const mbStart = Date.now();
    let mbResult = await safeCall('musicbrainz', () => MusicBrainz.getArtistById(decodedMbid));
    if (!mbResult.ok && isTransientMusicBrainzError(mbResult.error.code, mbResult.error.message)) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      mbResult = await safeCall('musicbrainz', () => MusicBrainz.getArtistById(decodedMbid));
    }
    addProviderTiming(trace, 'musicbrainz', Date.now() - mbStart);
    if (mbResult.ok) {
      providersUsed.push('musicbrainz');
    }
    if (!mbResult.ok) {
      logger.warn('[OffDaWallV2] Artist upstream unavailable:', decodedMbid, mbResult.error);
      return respondError(
        'artist_upstream_unavailable',
        'Artist data provider temporarily unavailable',
        {
          payloadMode: 'preview',
          providersUsed,
          cache: { hit: false },
          status: 'rate_limited',
          emptyReason: mbResult.error.code || 'provider_unavailable',
          ...routeMeta(trace),
        },
        503
      );
    }
    const mbArtist = mbResult.data;

    if (!mbArtist) {
      logger.debug('[OffDaWallV2] Artist not found:', decodedMbid);
      return respondError(
        'artist_not_found',
        'Artist not found',
        { payloadMode: 'preview', providersUsed, cache: { hit: false }, ...routeMeta(trace) },
        404
      );
    }

    // Build a quick Spotify-first partial profile while waiting for full aggregation.
    let fastArtist: Artist = {
      ...mbArtist,
      imageUrl: normalizeImageUrl(mbArtist.imageUrl || mbArtist.image),
      image: normalizeImageUrl(mbArtist.imageUrl || mbArtist.image),
      genres: mbArtist.genres || [],
      tags: mbArtist.tags || [],
    };

    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      const spotifyQuick = await withTimeBudget(
        (async () => {
          const spotifyStart = Date.now();
          const value = await safeCall('spotify', () => Spotify.searchArtistByName(mbArtist.name));
          addProviderTiming(trace, 'spotify', Date.now() - spotifyStart);
          return value;
        })(),
        1200
      );
      if (spotifyQuick.completed && spotifyQuick.value?.ok && spotifyQuick.value.data) {
        const spotifyArtist = spotifyQuick.value.data;
        const spotifyImage = normalizeImageUrl(Spotify.extractArtistImage(spotifyArtist));
        fastArtist = {
          ...fastArtist,
          imageUrl: spotifyImage || fastArtist.imageUrl,
          image: spotifyImage || fastArtist.image,
          popularity:
            typeof spotifyArtist.popularity === 'number'
              ? spotifyArtist.popularity / 100
              : fastArtist.popularity,
          followers: spotifyArtist.followers?.total ?? fastArtist.followers,
          genres: spotifyArtist.genres?.length ? spotifyArtist.genres.slice(0, 6) : fastArtist.genres,
        };
        providersUsed.push('spotify');
      }
    }

    const fullProfileResult = await withTimeBudget(
      (async () => {
        const aggStart = Date.now();
        const value = await safeCall('aggregator', () => getArtistProfile(decodedMbid));
        addProviderTiming(trace, 'aggregator', Date.now() - aggStart);
        return value;
      })(),
      4500
    );

    if (!fullProfileResult.completed) {
      fallbackUsed.push('spotify_fast_path');
      const response = respondOk(
        fastArtist,
        {
          payloadMode: 'preview',
          providersUsed,
          cache: { hit: false },
          status: 'partial',
          fastPath: true,
          fallbackUsed,
          emptyReason: 'aggregator_timeout',
          ...routeMeta(trace),
        }
      );
      logRouteResult('warn', trace, {
        success: true,
        status: 'partial',
        fallbackUsed,
        emptyReason: 'aggregator_timeout',
      });
      response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
      return response;
    }

    const artistResult = fullProfileResult.value;
    const artist = artistResult?.ok ? artistResult.data : null;
    if (!artist) {
      fallbackUsed.push('spotify_fast_path');
      const response = respondOk(
        fastArtist,
        {
          payloadMode: 'preview',
          providersUsed,
          cache: { hit: false },
          status: 'partial',
          fastPath: true,
          fallbackUsed,
          emptyReason: 'aggregator_failed',
          ...routeMeta(trace),
        }
      );
      logRouteResult('warn', trace, {
        success: true,
        status: 'partial',
        fallbackUsed,
        emptyReason: 'aggregator_failed',
      });
      response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
      return response;
    }

    logger.debug('[OffDaWallV2] Successfully fetched artist:', artist.name);

    const response = respondOk(
      artist,
      {
        payloadMode: 'preview',
        providersUsed: [...new Set([...providersUsed, 'aggregator'])],
        cache: { hit: false },
        status: 'ok',
        fastPath: false,
        ...routeMeta(trace),
      }
    );
    logRouteResult('info', trace, { success: true, status: 'ok' });
    response.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
    return response;
  } catch (error) {
    logger.error('[OffDaWallV2] Error fetching artist:', error);
    logRouteResult('error', trace, { success: false, error: `${error}` });
    return respondError(
      'artist_failed',
      'Failed to fetch artist profile',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false }, ...routeMeta(trace) },
      500
    );
  }
}

