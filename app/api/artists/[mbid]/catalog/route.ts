import * as MusicBrainz from '@/lib/services/musicbrainz';
import * as Deezer from '@/lib/services/deezer';
import * as Spotify from '@/lib/services/spotify';
import { getCoverArtUrl, getCoverArtUrlForReleaseGroup } from '@/lib/services/coverart';
import * as LastFm from '@/lib/services/lastfm';
import { CACHE_TTL, getFromCacheWithMeta, setCache } from '@/lib/cache';
import { normalizeImageUrl, toImageProxyUrl } from '@/lib/images';
import { logger } from '@/lib/logger';
import { getClientId, rateLimit } from '@/lib/api-guard';
import { respondOk, respondError } from '@/lib/api-response';
import { addProviderTiming, logRouteResult, routeMeta, startRouteTrace } from '@/lib/observability';
import { safeCall } from '@/lib/provider-safe';
import { withTimeBudget } from '@/lib/services/fast-path';
import type { Track } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;
const DEEP_DIVE_TIME_BUDGET_MS = 25_000;
const DEEP_DIVE_MB_TIME_BUDGET_MS = 8_000;
const DEEP_DIVE_MAX_RELEASE_GROUPS_COLD = 12;
const DEEP_DIVE_RELEASE_LOOKUP_COLD = 8;
const DEEP_DIVE_COVER_LOOKUP_COLD = 8;
const PREVIEW_MB_TIME_BUDGET_MS = 2_500;
const PREVIEW_FAST_ALBUM_LIMIT = 12;
const PREVIEW_WARM_COVER_LIMIT = 8;
const previewWarmInFlight = new Map<string, Promise<void>>();

function warmPreviewCatalogCache(cacheKey: string, releaseGroups: any[]) {
  if (previewWarmInFlight.has(cacheKey)) {
    return;
  }
  const task = (async () => {
    const normalizedAlbums = await Promise.all(
      releaseGroups.map(async (album, index) => {
        let coverArtUrl = album.coverArtUrl;
        if (!coverArtUrl && index < PREVIEW_WARM_COVER_LIMIT) {
          const rgCoverResult = await safeCall('coverart', () =>
            getCoverArtUrlForReleaseGroup(album.releaseGroupMbid || album.mbid)
          );
          coverArtUrl = rgCoverResult.ok ? rgCoverResult.data || coverArtUrl : coverArtUrl;
        }
        return {
          ...album,
          releaseGroupMbid: album.releaseGroupMbid || album.mbid,
          coverArtUrl: toImageProxyUrl(coverArtUrl),
        };
      })
    );
    setCache(cacheKey, { mode: 'preview', albums: normalizedAlbums, fallbackUsed: ['mb-release-groups'] }, CACHE_TTL.CATALOG);
  })()
    .catch((error) => {
      logger.warn('[OffDaWallV2] preview catalog warm failed', error);
    })
    .finally(() => {
      previewWarmInFlight.delete(cacheKey);
    });
  previewWarmInFlight.set(cacheKey, task);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const trace = startRouteTrace('api/artists/[mbid]/catalog');
  try {
    const { mbid } = await params;
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get('mode') || 'preview').toLowerCase();
    const isDeepDive = mode === 'deep-dive' || mode === 'deep';
    const clientId = getClientId(request);
    if (isDeepDive) {
      const limit = rateLimit({ key: `catalog-deep:${clientId}`, limit: 6, windowMs: 10 * 60_000 });
      if (!limit.ok) {
        const response = respondOk(
          {
            mode: 'deep-dive',
            albums: [],
            message: 'Rate limited — retrying shortly.',
            emptyReason: 'rate_limited',
            fallbackUsed: ['rate_limited'],
          },
          {
            payloadMode: 'deep',
            providersUsed: [],
            cache: { hit: false },
            status: 'rate_limited',
            emptyReason: 'rate_limited',
            fallbackUsed: ['rate_limited'],
            ...routeMeta(trace),
          }
        );
        logRouteResult('warn', trace, { success: true, status: 'rate_limited', emptyReason: 'rate_limited' });
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
      const cachedAlbums = cached.data?.albums || [];
      const cachedStatus =
        cachedEmptyReason === 'rate_limited'
          ? 'rate_limited'
          : cachedAlbums.length === 0
            ? 'empty'
            : cached.data?.partial || (Array.isArray(cachedFallbackUsed) && cachedFallbackUsed.length > 0)
              ? 'partial'
              : 'ok';
      const response = respondOk(
        cached.data,
        {
          payloadMode: isDeepDive ? 'deep' : 'preview',
          providersUsed,
          cache: { hit: true, stale: cached.stale },
          fallbackUsed: cachedFallbackUsed,
          emptyReason: cachedEmptyReason,
          status: cachedStatus,
          ...routeMeta(trace),
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
      return response;
    }
    
    let fallbackUsed: string[] = ['mb-release-groups'];
    let emptyReason: string | undefined;

    // Primary: release groups (preview has strict cold-start budget)
    let releaseGroupsResult: any;
    if (!isDeepDive) {
      const timed = await withTimeBudget(
        (async () => {
          const rgStart = Date.now();
          const result = await safeCall('musicbrainz', () =>
            MusicBrainz.getArtistReleaseGroups(mbid, 50)
          );
          addProviderTiming(trace, 'musicbrainz', Date.now() - rgStart);
          return result;
        })(),
        PREVIEW_MB_TIME_BUDGET_MS
      );
      releaseGroupsResult = timed.completed
        ? timed.value
        : ({ ok: false, error: new Error('provider_timeout') } as const);
      if (!timed.completed) {
        fallbackUsed = ['mb-timeout-fast-path'];
      }
    } else {
      const timed = await withTimeBudget(
        (async () => {
          const rgStart = Date.now();
          const result = await safeCall('musicbrainz', () =>
            MusicBrainz.getArtistReleaseGroups(mbid, 50)
          );
          addProviderTiming(trace, 'musicbrainz', Date.now() - rgStart);
          return result;
        })(),
        DEEP_DIVE_MB_TIME_BUDGET_MS
      );
      releaseGroupsResult = timed.completed
        ? timed.value
        : ({ ok: false, error: new Error('provider_timeout') } as const);
      if (!timed.completed) {
        fallbackUsed = ['mb-timeout-fast-path'];
      }
    }
    let releaseGroups = releaseGroupsResult.ok ? releaseGroupsResult.data : [];
    if (releaseGroupsResult.ok) providersUsed.push('musicbrainz');

    // Fallback A: artist releases (limit 50)
    if (releaseGroups.length === 0) {
      fallbackUsed = ['mb-releases'];
      const releasesFallbackStart = Date.now();
      const releaseFallbackResult = await safeCall('musicbrainz', () =>
        MusicBrainz.getArtistReleasesFallback(mbid, 50)
      );
      addProviderTiming(trace, 'musicbrainz', Date.now() - releasesFallbackStart);
      releaseGroups = releaseFallbackResult.ok ? releaseFallbackResult.data : [];
      if (releaseFallbackResult.ok && !providersUsed.includes('musicbrainz')) {
        providersUsed.push('musicbrainz');
      }
    }
    
    // Get artist name for Deezer search
    const artistStart = Date.now();
    const artistResult = await safeCall('musicbrainz', () => MusicBrainz.getArtistById(mbid));
    addProviderTiming(trace, 'musicbrainz', Date.now() - artistStart);
    const artist = artistResult.ok ? artistResult.data : null;
    if (artistResult.ok && !providersUsed.includes('musicbrainz')) {
      providersUsed.push('musicbrainz');
    }
    
    if (!artist) {
      return respondError(
        'artist_not_found',
        'Artist not found',
        { payloadMode: isDeepDive ? 'deep' : 'preview', providersUsed, cache: { hit: false }, ...routeMeta(trace) },
        404
      );
    }

    if (!isDeepDive) {
      if (releaseGroups.length === 0) {
        // Fallback: minimal Deezer preview when MusicBrainz is empty
        let previewTracks: Track[] = [];
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

        if (previewTracks.length === 0 && process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
          const spotifyArtistResult = await safeCall('spotify', () => Spotify.searchArtistByName(artist.name));
          const spotifyArtist = spotifyArtistResult.ok ? spotifyArtistResult.data : null;
          if (spotifyArtist && !providersUsed.includes('spotify')) {
            providersUsed.push('spotify');
          }
          if (spotifyArtist) {
            const spotifyTracksResult = await safeCall('spotify', () =>
              Spotify.getArtistTopTracks(spotifyArtist.id)
            );
            const spotifyTracks = spotifyTracksResult.ok ? spotifyTracksResult.data : [];
            if (spotifyTracksResult.ok && !providersUsed.includes('spotify')) {
              providersUsed.push('spotify');
            }
            previewTracks = spotifyTracks.map((track) => ({
              id: `spotify:${track.id}`,
              title: track.name,
              artistName: track.artists?.[0]?.name || artist.name,
              albumTitle: track.album ? 'Top Tracks' : undefined,
              albumArt: toImageProxyUrl(normalizeImageUrl(track.album?.images?.[0]?.url)),
              duration: undefined,
              previewUrl: track.preview_url || undefined,
              externalUrl: track.external_urls?.spotify,
            }));
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
                type: 'compilation',
                trackCount: previewTracks.length,
                coverArtUrl: toImageProxyUrl(previewTracks[0]?.albumArt),
                tracks: previewTracks.slice(0, 20),
              },
            ],
            message:
              previewTracks[0]?.id?.startsWith('spotify:')
                ? 'Catalog from MusicBrainz unavailable — showing Spotify results.'
                : 'Catalog from MusicBrainz unavailable — showing Deezer results.',
            fallbackUsed: previewTracks[0]?.id?.startsWith('spotify:') ? ['spotify-top-tracks'] : ['deezer-top-tracks'],
          };
          setCache(cacheKey, response, CACHE_TTL.CATALOG);
          const resp = respondOk(
            response,
            {
              payloadMode: 'preview',
              providersUsed,
              cache: { hit: false },
              fallbackUsed: response.fallbackUsed,
              status: 'partial',
              ...routeMeta(trace),
            }
          );
          logRouteResult('info', trace, { success: true, status: 'partial', fallbackUsed: response.fallbackUsed });
          resp.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
          return resp;
        }

        fallbackUsed = ['none'];
        emptyReason = releaseGroupsResult.ok ? 'mb_empty' : 'mb_failed';
      const resp = respondOk(
        {
            mode: 'preview',
            albums: [],
            message: 'No releases found for this artist',
            emptyReason,
            fallbackUsed,
          },
          {
            payloadMode: 'preview',
            providersUsed,
            cache: { hit: false },
          fallbackUsed,
          emptyReason,
          status: emptyReason === 'mb_failed' ? 'rate_limited' : 'empty',
          ...routeMeta(trace),
        }
      );
      logRouteResult('warn', trace, { success: true, status: emptyReason === 'mb_failed' ? 'rate_limited' : 'empty', emptyReason });
      resp.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
      return resp;
    }

      const fastAlbums = releaseGroups.slice(0, PREVIEW_FAST_ALBUM_LIMIT).map((album: any) => ({
        ...album,
        releaseGroupMbid: album.releaseGroupMbid || album.mbid,
        coverArtUrl: toImageProxyUrl(album.coverArtUrl),
      }));
      const response = {
        mode: 'preview',
        albums: fastAlbums,
        partial: releaseGroups.length > fastAlbums.length,
        message:
          releaseGroups.length > fastAlbums.length
            ? 'Showing quick preview while full catalog details are warming.'
            : undefined,
        fallbackUsed: fallbackUsed.length > 0 ? fallbackUsed : ['mb-release-groups-fast'],
      };
      if (fastAlbums.length > 0) {
        setCache(cacheKey, response, 2 * 60 * 1000, 20 * 60 * 1000);
        warmPreviewCatalogCache(cacheKey, releaseGroups);
      }
      const resp = respondOk(
        response,
        {
          payloadMode: 'preview',
          providersUsed,
          cache: { hit: false },
          fallbackUsed: response.fallbackUsed,
          status: response.partial ? 'partial' : 'ok',
          ...routeMeta(trace),
        }
      );
      logRouteResult('info', trace, {
        success: true,
        status: response.partial ? 'partial' : 'ok',
        fallbackUsed: response.fallbackUsed,
      });
      resp.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
      return resp;
    }
    
    // Try to get tracks from Deezer for preview URLs
    let tracks: Track[] = [];
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

    if (tracks.length === 0 && process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      const spotifyArtistResult = await safeCall('spotify', () => Spotify.searchArtistByName(artist.name));
      const spotifyArtist = spotifyArtistResult.ok ? spotifyArtistResult.data : null;
      if (spotifyArtist && !providersUsed.includes('spotify')) {
        providersUsed.push('spotify');
      }
      if (spotifyArtist) {
        const spotifyTracksResult = await safeCall('spotify', () =>
          Spotify.getArtistTopTracks(spotifyArtist.id)
        );
        const spotifyTracks = spotifyTracksResult.ok ? spotifyTracksResult.data : [];
        if (spotifyTracksResult.ok && !providersUsed.includes('spotify')) {
          providersUsed.push('spotify');
        }
        tracks = spotifyTracks.map((track) => ({
          id: `spotify:${track.id}`,
          title: track.name,
          artistName: track.artists?.[0]?.name || artist.name,
          albumTitle: track.album?.name,
          albumArt: toImageProxyUrl(normalizeImageUrl(track.album?.images?.[0]?.url)),
          previewUrl: track.preview_url || undefined,
          externalUrl: track.external_urls?.spotify,
        }));
      }
    }

    const normalizedAlbums: any[] = [];
    const deepMaxGroups = refresh ? releaseGroups.length : Math.min(releaseGroups.length, DEEP_DIVE_MAX_RELEASE_GROUPS_COLD);
    const groupsForDeep = releaseGroups.slice(0, deepMaxGroups);
    const deepReleaseLookupLimit = refresh ? groupsForDeep.length : DEEP_DIVE_RELEASE_LOOKUP_COLD;
    const deepCoverLookupLimit = refresh ? groupsForDeep.length : DEEP_DIVE_COVER_LOOKUP_COLD;
    const deadlineMs = Date.now() + DEEP_DIVE_TIME_BUDGET_MS;
    const concurrency = 4;

    for (let i = 0; i < groupsForDeep.length; i += concurrency) {
      if (Date.now() > deadlineMs) {
        logger.warn('[OffDaWallV2] Deep-dive catalog time budget exceeded, returning partial results');
        break;
      }
      const batch = groupsForDeep.slice(i, i + concurrency);
      const processed = await Promise.all(
        batch.map(async (album: any, batchIndex: number) => {
          const globalIndex = i + batchIndex;
          let preferred: any = undefined;
          let releaseMbid: string | undefined;

          if (globalIndex < deepReleaseLookupLimit) {
            const releasesResult = await safeCall('musicbrainz', () => MusicBrainz.getReleaseGroupReleases(album.mbid, 3));
            const releases = releasesResult.ok ? releasesResult.data : [];
            if (releasesResult.ok && !providersUsed.includes('musicbrainz')) {
              providersUsed.push('musicbrainz');
            }
            preferred = releases.find((r: any) => r.status === 'Official') || releases[0];
            releaseMbid = preferred?.id;
          }

          let coverArtUrl = album.coverArtUrl;
          if (!coverArtUrl && releaseMbid && globalIndex < deepCoverLookupLimit) {
            const coverArtResult = await safeCall('coverart', () => getCoverArtUrl(releaseMbid));
            coverArtUrl = coverArtResult.ok ? coverArtResult.data || coverArtUrl : coverArtUrl;
            if (coverArtResult.ok && !providersUsed.includes('coverart')) {
              providersUsed.push('coverart');
            }
          }
          if (!coverArtUrl && globalIndex < deepCoverLookupLimit) {
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
      const trackSource = tracks[0]?.id?.startsWith('spotify:')
        ? 'spotify'
        : tracks[0]?.id?.startsWith('deezer:')
          ? 'deezer'
          : 'unknown';
      normalizedAlbums.unshift({
        mbid: trackSource === 'spotify' ? `spotify-top-${mbid}` : `deezer-top-${mbid}`,
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
        {
          payloadMode: 'deep',
          providersUsed,
          cache: { hit: false },
          fallbackUsed,
          emptyReason,
          status: emptyReason === 'mb_failed' ? 'rate_limited' : 'empty',
          ...routeMeta(trace),
        }
      );
    }

    const response = {
      mode: 'deep-dive',
      albums: normalizedAlbums,
      allTracks: tracks,
      partial: normalizedAlbums.length < releaseGroups.length,
      message: normalizedAlbums.some((album) => album.mbid?.startsWith('spotify-top-'))
        ? 'Catalog from MusicBrainz unavailable — showing Spotify results.'
        : normalizedAlbums.some((album) => album.mbid?.startsWith('deezer-top-'))
          ? 'Catalog from MusicBrainz unavailable — showing Deezer results.'
          : normalizedAlbums.length < releaseGroups.length
            ? 'Showing partial deep-dive catalog while additional releases are prepared.'
          : undefined,
      fallbackUsed: normalizedAlbums.some((album) => album.mbid?.startsWith('spotify-top-'))
        ? ['spotify-top-tracks']
        : normalizedAlbums.some((album) => album.mbid?.startsWith('deezer-top-'))
          ? ['deezer-top-tracks']
          : fallbackUsed,
    };
    if (normalizedAlbums.length > 0 || tracks.length > 0) {
      setCache(cacheKey, response, CACHE_TTL.CATALOG);
    }

    logRouteResult('info', trace, {
      success: true,
      mbid,
      status:
        normalizedAlbums.length === 0
          ? 'empty'
          : response.partial ||
              response.fallbackUsed?.includes('deezer-top-tracks') ||
              response.fallbackUsed?.includes('spotify-top-tracks')
            ? 'partial'
            : 'ok',
      fallbackUsed: response.fallbackUsed,
      emptyReason,
    });
    const resp = respondOk(
      response,
      {
        payloadMode: isDeepDive ? 'deep' : 'preview',
        providersUsed,
        cache: { hit: false },
        fallbackUsed: normalizedAlbums.some((album) => album.mbid?.startsWith('spotify-top-'))
          ? ['spotify-top-tracks']
          : normalizedAlbums.some((album) => album.mbid?.startsWith('deezer-top-'))
            ? ['deezer-top-tracks']
            : fallbackUsed,
        status: normalizedAlbums.length === 0
          ? 'empty'
          : response.partial ||
            response.fallbackUsed?.includes('deezer-top-tracks') ||
            response.fallbackUsed?.includes('spotify-top-tracks')
            ? 'partial'
            : 'ok',
        ...routeMeta(trace),
      }
    );
    resp.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return resp;
  } catch (error) {
    logger.error('[OffDaWallV2] Catalog API error:', error);
    logRouteResult('error', trace, { success: false, error: `${error}` });
    return respondError(
      'catalog_failed',
      'Failed to fetch catalog',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false }, ...routeMeta(trace) },
      500
    );
  }
}

