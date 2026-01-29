import { NextRequest } from 'next/server';
import * as MusicBrainz from '@/lib/services/musicbrainz';
import * as Deezer from '@/lib/services/deezer';
import { generateRecommendations } from '@/lib/recommendation-engine';
import type { Album } from '@/lib/types';
import { CACHE_TTL, getFromCacheWithMeta, setCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { respondOk, respondError } from '@/lib/api-response';
import { logEvent } from '@/lib/observability';
import { safeCall } from '@/lib/provider-safe';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  try {
    const { mbid } = await params;
    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get('refresh') === '1';
    const cacheKey = `recommendations:${mbid}`;
    const cached = refresh ? null : getFromCacheWithMeta(cacheKey);
    if (cached?.data) {
      const resp = respondOk(
        cached.data,
        { payloadMode: 'preview', providersUsed: [], cache: { hit: true, stale: cached.stale } }
      );
      resp.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
      return resp;
    }

    logger.debug('[OffDaWallV2] Fetching recommendations for artist:', mbid);

    // Get artist name for Deezer lookup
    const artistResult = await safeCall('musicbrainz', () => MusicBrainz.getArtistById(mbid));
    const artist = artistResult.ok ? artistResult.data : null;
    const providersUsed: string[] = [];
    if (artistResult.ok) {
      providersUsed.push('musicbrainz');
    }
    if (!artist) {
      const fallback = generateRecommendations([]);
      const resp = respondOk(
        fallback,
        { payloadMode: 'preview', providersUsed, cache: { hit: false } }
      );
      resp.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
      return resp;
    }

    // Build recommendations from Deezer top tracks for fast responses
    let enhancedReleases: Album[] = [];
    const deezerArtistResult = await safeCall('deezer', () => Deezer.searchArtist(artist.name));
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

    // Generate recommendations using the engine
    let recommendations = generateRecommendations(enhancedReleases);

    if (Object.values(recommendations).every((list) => list.length === 0) && deezerArtist) {
      await new Promise((resolve) => setTimeout(resolve, 600));
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
      recommendations = generateRecommendations(enhancedReleases);
    }

    if (Object.values(recommendations).some((list) => list.length > 0)) {
      setCache(cacheKey, recommendations, CACHE_TTL.RECOMMENDATIONS);
    }
    logEvent('info', '[OffDaWallV2] api/artists/[mbid]/recommendations', { success: true, mbid });
    const resp = respondOk(
      recommendations,
      { payloadMode: 'preview', providersUsed, cache: { hit: false } }
    );
    resp.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return resp;
  } catch (error) {
    logger.error('[OffDaWallV2] Recommendations API error:', error);
    logEvent('error', '[OffDaWallV2] api/artists/[mbid]/recommendations', { success: false, error: `${error}` });
    return respondError(
      'recommendations_failed',
      'Failed to generate recommendations',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}

