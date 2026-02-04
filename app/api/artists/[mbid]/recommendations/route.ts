import { NextRequest } from 'next/server';
import * as MusicBrainz from '@/lib/services/musicbrainz';
import * as Deezer from '@/lib/services/deezer';
import * as Spotify from '@/lib/services/spotify';
import { generateRecommendations } from '@/lib/recommendation-engine';
import type { Album } from '@/lib/types';
import { CACHE_TTL, getFromCacheWithMeta, setCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { respondOk, respondError } from '@/lib/api-response';
import { addProviderTiming, logRouteResult, routeMeta, startRouteTrace } from '@/lib/observability';
import { safeCall } from '@/lib/provider-safe';
import { normalizeImageUrl, toImageProxyUrl } from '@/lib/images';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const trace = startRouteTrace('api/artists/[mbid]/recommendations');
  try {
    const { mbid } = await params;
    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get('refresh') === '1';
    const cacheKey = `recommendations:${mbid}`;
    const cached = refresh ? null : getFromCacheWithMeta<{
      artistMbid: string;
      categories: ReturnType<typeof generateRecommendations>;
      message?: string;
    }>(cacheKey);
    if (cached?.data) {
      const cachedCategories = cached.data?.categories || {};
      const hasAny = Object.values(cachedCategories).some((list: any) => Array.isArray(list) && list.length > 0);
      const resp = respondOk(
        cached.data,
        {
          payloadMode: 'preview',
          providersUsed: [],
          cache: { hit: true, stale: cached.stale },
          status: hasAny ? 'ok' : 'empty',
          ...routeMeta(trace),
        }
      );
      resp.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
      return resp;
    }

    logger.debug('[OffDaWallV2] Fetching recommendations for artist:', mbid);

    // Get artist name for Deezer lookup
    const artistStart = Date.now();
    const artistResult = await safeCall('musicbrainz', () => MusicBrainz.getArtistById(mbid));
    addProviderTiming(trace, 'musicbrainz', Date.now() - artistStart);
    const artist = artistResult.ok ? artistResult.data : null;
    const providersUsed: string[] = [];
    if (artistResult.ok) {
      providersUsed.push('musicbrainz');
    }
    if (!artist) {
      const fallback = generateRecommendations([]);
      const resp = respondOk(
        {
          artistMbid: mbid,
          categories: fallback,
          message: 'Recommendations unavailable at the moment.',
        },
        {
          payloadMode: 'preview',
          providersUsed,
          cache: { hit: false },
          emptyReason: 'artist_not_found',
          status: 'empty',
          ...routeMeta(trace),
        }
      );
      logRouteResult('warn', trace, { success: true, status: 'empty', emptyReason: 'artist_not_found' });
      resp.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
      return resp;
    }

    // Build recommendations from Deezer top tracks for fast responses
    let enhancedReleases: Album[] = [];
    const deezerArtistStart = Date.now();
    const deezerArtistResult = await safeCall('deezer', () => Deezer.searchArtist(artist.name));
    addProviderTiming(trace, 'deezer', Date.now() - deezerArtistStart);
    const deezerArtist = deezerArtistResult.ok ? deezerArtistResult.data : null;
    if (deezerArtistResult.ok && !providersUsed.includes('deezer')) {
      providersUsed.push('deezer');
    }

    if (deezerArtist) {
      logger.debug('[OffDaWallV2] Found Deezer artist, fetching tracks');
      const deezerTracksResult = await safeCall('deezer', () => Deezer.getArtistTopTracks(deezerArtist.id));
      const deezerTracks = deezerTracksResult.ok ? deezerTracksResult.data : [];
      if (deezerTracksResult.ok && !providersUsed.includes('deezer')) {
        providersUsed.push('deezer');
      }

      if (deezerTracks.length > 0) {
        enhancedReleases = [{
          mbid: `deezer-top-${mbid}`,
          title: `${artist.name} Top Tracks`,
          artistMbid: mbid,
          artistName: artist.name,
          type: 'album',
          trackCount: deezerTracks.length,
          tracks: deezerTracks,
        }];
      }
    }

    if (enhancedReleases.length === 0 && process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      const spotifyArtistStart = Date.now();
      const spotifyArtistResult = await safeCall('spotify', () => Spotify.searchArtistByName(artist.name));
      addProviderTiming(trace, 'spotify', Date.now() - spotifyArtistStart);
      const spotifyArtist = spotifyArtistResult.ok ? spotifyArtistResult.data : null;
      if (spotifyArtist && !providersUsed.includes('spotify')) {
        providersUsed.push('spotify');
      }
      if (spotifyArtist) {
        const spotifyTracksStart = Date.now();
        const spotifyTracksResult = await safeCall('spotify', () =>
          Spotify.getArtistTopTracks(spotifyArtist.id)
        );
        addProviderTiming(trace, 'spotify', Date.now() - spotifyTracksStart);
        const spotifyTracks = spotifyTracksResult.ok ? spotifyTracksResult.data : [];
        if (spotifyTracksResult.ok && !providersUsed.includes('spotify')) {
          providersUsed.push('spotify');
        }
        if (spotifyTracks.length > 0) {
          enhancedReleases = [{
            mbid: `spotify-top-${mbid}`,
            title: `${artist.name} Top Tracks`,
            artistMbid: mbid,
            artistName: artist.name,
            type: 'album',
            trackCount: spotifyTracks.length,
            tracks: spotifyTracks.map((track) => ({
              id: `spotify:${track.id}`,
              title: track.name,
              artistName: track.artists?.[0]?.name || artist.name,
              albumTitle: track.album?.name,
              albumArt: toImageProxyUrl(normalizeImageUrl(track.album?.images?.[0]?.url)),
              previewUrl: track.preview_url || undefined,
              externalUrl: track.external_urls?.spotify,
            })),
          }];
        }
      }
    }

    // Generate recommendations using the engine
    let recommendations = generateRecommendations(enhancedReleases);

    if (Object.values(recommendations).every((list) => list.length === 0) && deezerArtist) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const deezerTracksStart = Date.now();
      const deezerRetryStart = Date.now();
      const deezerTracksResult = await safeCall('deezer', () => Deezer.getArtistTopTracks(deezerArtist.id));
      addProviderTiming(trace, 'deezer', Date.now() - deezerRetryStart);
      addProviderTiming(trace, 'deezer', Date.now() - deezerTracksStart);
      const deezerTracks = deezerTracksResult.ok ? deezerTracksResult.data : [];
      if (deezerTracksResult.ok && !providersUsed.includes('deezer')) {
        providersUsed.push('deezer');
      }
      if (deezerTracks.length > 0) {
        enhancedReleases = [{
          mbid: `deezer-top-${mbid}`,
          title: `${artist.name} Top Tracks`,
          artistMbid: mbid,
          artistName: artist.name,
          type: 'album',
          trackCount: deezerTracks.length,
          tracks: deezerTracks,
        }];
      }
      recommendations = generateRecommendations(enhancedReleases);
    }

    const hasAny = Object.values(recommendations).some((list) => list.length > 0);
    const responsePayload = {
      artistMbid: mbid,
      categories: recommendations,
      message: hasAny
        ? undefined
        : enhancedReleases.some((release) => release.mbid?.startsWith('spotify-top-'))
          ? 'Recommendations unavailable from Deezer — showing Spotify results.'
          : enhancedReleases.some((release) => release.mbid?.startsWith('deezer-top-'))
            ? 'Recommendations unavailable from MusicBrainz — showing Deezer results.'
            : 'No recommendations available right now.',
    };

    if (hasAny) {
      setCache(cacheKey, responsePayload, CACHE_TTL.RECOMMENDATIONS);
    }
    logRouteResult('info', trace, {
      success: true,
      mbid,
      status: hasAny ? 'ok' : 'empty',
      emptyReason: hasAny ? undefined : 'no_tracks',
    });
    const resp = respondOk(
      responsePayload,
      {
        payloadMode: 'preview',
        providersUsed,
        cache: { hit: false },
        source: providersUsed.includes('deezer')
          ? 'deezer'
          : providersUsed.includes('spotify')
            ? 'spotify'
            : 'musicbrainz',
        emptyReason: hasAny ? undefined : 'no_tracks',
        status: hasAny ? 'ok' : 'empty',
        fallbackUsed: enhancedReleases.some((release) => release.mbid?.startsWith('spotify-top-'))
          ? ['spotify-top-tracks']
          : enhancedReleases.some((release) => release.mbid?.startsWith('deezer-top-'))
            ? ['deezer-top-tracks']
            : undefined,
        ...routeMeta(trace),
      }
    );
    resp.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return resp;
  } catch (error) {
    logger.error('[OffDaWallV2] Recommendations API error:', error);
    logRouteResult('error', trace, { success: false, error: `${error}` });
    return respondError(
      'recommendations_failed',
      'Failed to generate recommendations',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false }, ...routeMeta(trace) },
      500
    );
  }
}

