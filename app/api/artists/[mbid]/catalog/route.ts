import * as MusicBrainz from '@/lib/services/musicbrainz';
import * as Deezer from '@/lib/services/deezer';
import { getCoverArtUrl, getCoverArtUrlForReleaseGroup } from '@/lib/services/coverart';
import * as LastFm from '@/lib/services/lastfm';
import { CACHE_TTL, getFromCacheWithMeta, setCache } from '@/lib/cache';
import { normalizeImageUrl, toImageProxyUrl } from '@/lib/images';
import { logger } from '@/lib/logger';
import { getClientId, rateLimit } from '@/lib/api-guard';
import { respondOk, respondError } from '@/lib/api-response';
import { logEvent } from '@/lib/observability';
import { safeCall } from '@/lib/provider-safe';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mbid: string }> }
) {
  try {
    const { mbid } = await params;
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get('mode') || 'preview').toLowerCase();
    const isDeepDive = mode === 'deep-dive' || mode === 'deep';
    const clientId = getClientId(request);
    if (isDeepDive) {
      const limit = rateLimit({ key: `catalog-deep:${clientId}`, limit: 6, windowMs: 10 * 60_000 });
      if (!limit.ok) {
        const response = respondError(
          'rate_limited',
          'Deep-dive rate limit exceeded',
          { payloadMode: 'deep', providersUsed: [], cache: { hit: false } },
          429
        );
        response.headers.set('Retry-After', Math.ceil((limit.retryAfterMs || 0) / 1000).toString());
        return response;
      }
    }
    const refresh = searchParams.get('refresh') === '1';
    const cacheKey = `catalog:${mbid}:${isDeepDive ? 'deep-dive' : 'preview'}`;
    const cached = refresh ? null : getFromCacheWithMeta<any>(cacheKey);
    const providersUsed: string[] = [];
    if (cached?.data) {
      const cachedFallbackUsed = cached.data?.fallbackUsed;
      const cachedEmptyReason = cached.data?.emptyReason;
      const response = respondOk(
        cached.data,
        {
          payloadMode: isDeepDive ? 'deep' : 'preview',
          providersUsed,
          cache: { hit: true, stale: cached.stale },
          fallbackUsed: cachedFallbackUsed,
          emptyReason: cachedEmptyReason,
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
      return response;
    }
    
    let fallbackUsed = 'mb_release_groups';
    let emptyReason: string | undefined;

    // Primary: release groups
    let releaseGroupsResult = await safeCall('musicbrainz', () =>
      MusicBrainz.getArtistReleaseGroups(mbid, 50)
    );
    let releaseGroups = releaseGroupsResult.ok ? releaseGroupsResult.data : [];
    if (releaseGroupsResult.ok) providersUsed.push('musicbrainz');

    // Fallback A: artist releases (limit 50)
    if (releaseGroups.length === 0) {
      fallbackUsed = 'mb_releases';
      const releaseFallbackResult = await safeCall('musicbrainz', () =>
        MusicBrainz.getArtistReleasesFallback(mbid, 50)
      );
      releaseGroups = releaseFallbackResult.ok ? releaseFallbackResult.data : [];
      if (releaseFallbackResult.ok && !providersUsed.includes('musicbrainz')) {
        providersUsed.push('musicbrainz');
      }
    }
    
    // Get artist name for Deezer search
    const artistResult = await safeCall('musicbrainz', () => MusicBrainz.getArtistById(mbid));
    const artist = artistResult.ok ? artistResult.data : null;
    if (artistResult.ok && !providersUsed.includes('musicbrainz')) {
      providersUsed.push('musicbrainz');
    }
    
    if (!artist) {
      return respondError(
        'artist_not_found',
        'Artist not found',
        { payloadMode: isDeepDive ? 'deep' : 'preview', providersUsed, cache: { hit: false } },
        404
      );
    }

    if (!isDeepDive) {
      if (releaseGroups.length === 0) {
        // Fallback: minimal Deezer preview when MusicBrainz is empty
        let previewTracks = [];
        const deezerArtistResult = await safeCall('deezer', () => Deezer.searchArtist(artist.name));
        const deezerArtist = deezerArtistResult.ok ? deezerArtistResult.data : null;
        if (deezerArtistResult.ok) {
          providersUsed.push('deezer');
        }
        if (deezerArtist) {
          const previewResult = await safeCall('deezer', () => Deezer.getArtistTopTracks(deezerArtist.id, 30));
          previewTracks = previewResult.ok ? previewResult.data : [];
          if (previewResult.ok && !providersUsed.includes('deezer')) {
            providersUsed.push('deezer');
          }
        }

        if (previewTracks.length > 0) {
          const response = {
            mode: 'preview',
            albums: [
              {
                mbid: `deezer-top-${mbid}`,
                title: `${artist.name} Top Tracks`,
                artistMbid: mbid,
                artistName: artist.name,
                releaseDate: undefined,
                type: 'album',
                trackCount: previewTracks.length,
                coverArtUrl: toImageProxyUrl(previewTracks[0]?.albumArt),
                tracks: previewTracks.slice(0, 20),
              },
            ],
            message: 'Catalog from MusicBrainz unavailable — showing Deezer results.',
            fallbackUsed: 'deezer_top_tracks',
          };
          setCache(cacheKey, response, CACHE_TTL.CATALOG);
          const resp = respondOk(
            response,
            {
              payloadMode: 'preview',
              providersUsed,
              cache: { hit: false },
              fallbackUsed: 'deezer_top_tracks',
            }
          );
          resp.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
          return resp;
        }

        fallbackUsed = 'none';
        emptyReason = releaseGroupsResult.ok ? 'mb_empty' : 'mb_failed';
        const resp = respondOk(
          {
            mode: 'preview',
            albums: [],
            message: 'No releases found for this artist',
            emptyReason,
            fallbackUsed,
          },
          { payloadMode: 'preview', providersUsed, cache: { hit: false }, fallbackUsed, emptyReason }
        );
        resp.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
        return resp;
      }

      const coverArtLimit = 8;
      const normalizedAlbums = await Promise.all(releaseGroups.map(async (album, index) => {
        let coverArtUrl = album.coverArtUrl;
        if (!coverArtUrl && index < coverArtLimit) {
          const rgCoverResult = await safeCall('coverart', () =>
            getCoverArtUrlForReleaseGroup(album.releaseGroupMbid || album.mbid)
          );
          coverArtUrl = rgCoverResult.ok ? rgCoverResult.data || coverArtUrl : coverArtUrl;
          if (rgCoverResult.ok && !providersUsed.includes('coverart')) {
            providersUsed.push('coverart');
          }
        }

        return {
          ...album,
          releaseGroupMbid: album.releaseGroupMbid || album.mbid,
          coverArtUrl: toImageProxyUrl(coverArtUrl),
        };
      }));

      const response = {
        mode: 'preview',
        albums: normalizedAlbums,
        fallbackUsed,
      };
      if (normalizedAlbums.length > 0) {
        setCache(cacheKey, response, CACHE_TTL.CATALOG);
      }
      const resp = respondOk(
        response,
        { payloadMode: 'preview', providersUsed, cache: { hit: false }, fallbackUsed }
      );
      resp.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
      return resp;
    }
    
    // Try to get tracks from Deezer for preview URLs
    let tracks = [];
    const deezerArtistResult = await safeCall('deezer', () => Deezer.searchArtist(artist.name));
    const deezerArtist = deezerArtistResult.ok ? deezerArtistResult.data : null;
    if (deezerArtistResult.ok) {
      providersUsed.push('deezer');
    }
    if (deezerArtist) {
      const trackResult = await safeCall('deezer', () => Deezer.getArtistTopTracks(deezerArtist.id, 100));
      tracks = trackResult.ok ? trackResult.data : [];
      if (trackResult.ok && !providersUsed.includes('deezer')) {
        providersUsed.push('deezer');
      }
    }

    const normalizedAlbums: any[] = [];
    const deadlineMs = Date.now() + 110_000;
    const concurrency = 4;

    for (let i = 0; i < releaseGroups.length; i += concurrency) {
      if (Date.now() > deadlineMs) {
        logger.warn('[OffDaWallV2] Deep-dive catalog time budget exceeded, returning partial results');
        break;
      }
      const batch = releaseGroups.slice(i, i + concurrency);
      const processed = await Promise.all(
        batch.map(async (album) => {
          const releasesResult = await safeCall('musicbrainz', () => MusicBrainz.getReleaseGroupReleases(album.mbid, 3));
          const releases = releasesResult.ok ? releasesResult.data : [];
          if (releasesResult.ok && !providersUsed.includes('musicbrainz')) {
            providersUsed.push('musicbrainz');
          }
          const preferred = releases.find((r: any) => r.status === 'Official') || releases[0];
          const releaseMbid = preferred?.id;

          let coverArtUrl = album.coverArtUrl;
          if (!coverArtUrl && releaseMbid) {
            const coverArtResult = await safeCall('coverart', () => getCoverArtUrl(releaseMbid));
            coverArtUrl = coverArtResult.ok ? coverArtResult.data || coverArtUrl : coverArtUrl;
            if (coverArtResult.ok && !providersUsed.includes('coverart')) {
              providersUsed.push('coverart');
            }
          }
          if (!coverArtUrl) {
            const rgCoverResult = await safeCall('coverart', () =>
              getCoverArtUrlForReleaseGroup(album.releaseGroupMbid || album.mbid)
            );
            coverArtUrl = rgCoverResult.ok ? rgCoverResult.data || coverArtUrl : coverArtUrl;
            if (rgCoverResult.ok && !providersUsed.includes('coverart')) {
              providersUsed.push('coverart');
            }
          }

          const albumTitle = album.title.toLowerCase();
          const matchedTracks = tracks.filter(t => {
            const trackAlbum = t.albumTitle?.toLowerCase() || '';
            return trackAlbum.includes(albumTitle) || albumTitle.includes(trackAlbum);
          });

          // Last.fm fallback for cover art when available
          if (!coverArtUrl && process.env.LASTFM_API_KEY) {
            const lfInfoResult = await safeCall('lastfm', () => LastFm.getAlbumInfoByArtistTitle(artist.name, album.title));
            const lfInfo = lfInfoResult.ok ? lfInfoResult.data : null;
            coverArtUrl = LastFm.extractAlbumImage(lfInfo) || coverArtUrl;
            if (lfInfoResult.ok && !providersUsed.includes('lastfm')) {
              providersUsed.push('lastfm');
            }
          }

          const derivedTrackCount = preferred?.['track-count'] || album.trackCount || matchedTracks.length;

          return {
            ...album,
            releaseMbid,
            releaseGroupMbid: album.releaseGroupMbid || album.mbid,
            coverArtUrl: toImageProxyUrl(coverArtUrl || matchedTracks[0]?.albumArt),
            trackCount: derivedTrackCount,
            tracks: matchedTracks.slice(0, 20),
          };
        })
      );
      normalizedAlbums.push(...processed);
    }

    const hasAnyPreviews = normalizedAlbums.some(a => (a.tracks?.length || 0) > 0);

    if (!hasAnyPreviews && tracks.length > 0) {
      normalizedAlbums.unshift({
        mbid: `deezer-top-${mbid}`,
        title: `${artist.name} Top Tracks`,
        artistMbid: mbid,
        artistName: artist.name,
        releaseDate: undefined,
        type: 'album',
        trackCount: tracks.length,
        coverArtUrl: toImageProxyUrl(tracks[0]?.albumArt),
        tracks: tracks.slice(0, 50),
      });
    }

    if (normalizedAlbums.length === 0 && tracks.length === 0) {
      emptyReason = releaseGroupsResult.ok ? 'mb_empty' : 'mb_failed';
      return respondOk(
        {
          mode: 'deep-dive',
          albums: [],
          message: 'No releases found for this artist',
          emptyReason,
          fallbackUsed,
        },
        { payloadMode: 'deep', providersUsed, cache: { hit: false }, fallbackUsed, emptyReason }
      );
    }

    const response = {
      mode: 'deep-dive',
      albums: normalizedAlbums,
      allTracks: tracks,
      partial: normalizedAlbums.length < releaseGroups.length,
      message: normalizedAlbums.some((album) => album.mbid?.startsWith('deezer-top-'))
        ? 'Catalog from MusicBrainz unavailable — showing Deezer results.'
        : undefined,
      fallbackUsed: normalizedAlbums.some((album) => album.mbid?.startsWith('deezer-top-'))
        ? 'deezer_top_tracks'
        : fallbackUsed,
    };
    if (normalizedAlbums.length > 0 || tracks.length > 0) {
      setCache(cacheKey, response, CACHE_TTL.CATALOG);
    }

    logEvent('info', '[OffDaWallV2] api/artists/[mbid]/catalog', { success: true, mbid });
    const resp = respondOk(
      response,
      {
        payloadMode: isDeepDive ? 'deep' : 'preview',
        providersUsed,
        cache: { hit: false },
        fallbackUsed: normalizedAlbums.some((album) => album.mbid?.startsWith('deezer-top-'))
          ? 'deezer_top_tracks'
          : fallbackUsed,
      }
    );
    resp.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return resp;
  } catch (error) {
    logger.error('[OffDaWallV2] Catalog API error:', error);
    logEvent('error', '[OffDaWallV2] api/artists/[mbid]/catalog', { success: false, error: `${error}` });
    return respondError(
      'catalog_failed',
      'Failed to fetch catalog',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}

