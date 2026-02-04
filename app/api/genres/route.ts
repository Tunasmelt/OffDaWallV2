import { getAllGenres, TAXONOMY_CACHE_TAG } from '@/lib/genres';
import { revalidateTag } from 'next/cache';
import { respondOk, respondError } from '@/lib/api-response';
import { isDebugMode, logEvent } from '@/lib/observability';
import { getArtistsForGenre } from '@/lib/services/aggregator';
import { normalizeImageUrl, toImageProxyUrl } from '@/lib/images';
import { resolveArtistImage as resolveArtistImageService } from '@/lib/services/image-resolver';
import { getFromCacheWithMeta, setCache } from '@/lib/cache';
import { safeCall } from '@/lib/provider-safe';
import type { Genre } from '@/lib/types';
import * as Spotify from '@/lib/services/spotify';

const HOMEPAGE_PREVIEW_CACHE_KEY = 'genres:preview:v1';
const HOMEPAGE_PREVIEW_TTL_MS = 15 * 60 * 1000;
const HOMEPAGE_PREVIEW_STALE_MS = 6 * 60 * 60 * 1000;
const GENRE_PREVIEW_WORKERS = 3;
let warmingPreview = false;

async function resolveGenrePreviewImage(previewArtists: any[]): Promise<{
  imageUrl?: string;
  source?: 'artists' | 'spotify' | 'resolver';
}> {
  const fromArtists =
    normalizeImageUrl(previewArtists.find((a) => a.imageUrl)?.imageUrl) ||
    normalizeImageUrl(previewArtists.find((a) => a.image)?.image);
  if (fromArtists) {
    return { imageUrl: toImageProxyUrl(fromArtists) || fromArtists, source: 'artists' };
  }

  const candidate = previewArtists[0];
  if (!candidate?.mbid && !candidate?.name) {
    return {};
  }

  if (candidate?.name && process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    const spotifyResult = await safeCall('spotify', () => Spotify.searchArtistByName(candidate.name));
    if (spotifyResult.ok) {
      const spotifyImage = normalizeImageUrl(Spotify.extractArtistImage(spotifyResult.data));
      if (spotifyImage) {
        return { imageUrl: toImageProxyUrl(spotifyImage) || spotifyImage, source: 'spotify' };
      }
    }
  }

  const resolved = await resolveArtistImageService({
    mbid: candidate?.mbid,
    name: candidate?.name,
  });
  const resolvedUrl = normalizeImageUrl(resolved.imageUrl);
  return resolvedUrl
    ? { imageUrl: toImageProxyUrl(resolvedUrl) || resolvedUrl, source: 'resolver' }
    : {};
}

async function buildPreviewGenres(genres: Genre[], providersUsed: string[]) {
  let index = 0;
  const results: Genre[] = new Array(genres.length);

  async function worker() {
    while (index < genres.length) {
      const currentIndex = index++;
      const current = genres[currentIndex];
      const artistsResult = await safeCall('musicbrainz', () =>
        getArtistsForGenre(current.tags, 12)
      );
      if (artistsResult.ok && !providersUsed.includes('musicbrainz')) {
        providersUsed.push('musicbrainz');
      }
      const artists = artistsResult.ok ? artistsResult.data : [];
      const previewArtists = artists.slice(0, 4);
      const previewImage = await resolveGenrePreviewImage(previewArtists);
      const previewImageUrl = previewImage.imageUrl;
      if (previewImage.source === 'spotify' && !providersUsed.includes('spotify')) {
        providersUsed.push('spotify');
      }
      if (previewImage.source === 'resolver' && !providersUsed.includes('image-resolver')) {
        providersUsed.push('image-resolver');
      }

      results[currentIndex] = {
        ...current,
        previewArtists,
        previewImageUrl,
      };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(GENRE_PREVIEW_WORKERS, genres.length) }, () => worker())
  );

  return results;
}

function warmGenrePreviewCache(genres: Genre[]) {
  if (warmingPreview) return;
  warmingPreview = true;
  const providersUsed: string[] = [];
  void buildPreviewGenres(genres, providersUsed)
    .then((results) => {
      setCache(
        HOMEPAGE_PREVIEW_CACHE_KEY,
        { genres: results },
        HOMEPAGE_PREVIEW_TTL_MS,
        HOMEPAGE_PREVIEW_STALE_MS
      );
      if (isDebugMode()) {
        logEvent('info', '[OffDaWallV2] api/genres preview warm', {
          success: true,
          count: results.length,
          providersUsed,
        });
      }
    })
    .catch((error) => {
      if (isDebugMode()) {
        logEvent('warn', '[OffDaWallV2] api/genres preview warm failed', {
          error: `${error}`,
        });
      }
    })
    .finally(() => {
      warmingPreview = false;
    });
}

export async function GET(request: Request) {
  try {
    const genres = getAllGenres();
    const providersUsed: string[] = [];
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === '1';
    const refresh = searchParams.get('refresh') === '1';

    if (refresh) {
      revalidateTag(TAXONOMY_CACHE_TAG, 'max');
    }

    if (!isPreview) {
      logEvent('info', '[OffDaWallV2] api/genres', { success: true });
      const response = respondOk(
        { genres },
        {
          payloadMode: 'preview',
          providersUsed,
          cache: { hit: false },
          status: genres.length ? 'ok' : 'empty',
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');
      return response;
    }

    const cached = getFromCacheWithMeta<{ genres: Genre[] }>(HOMEPAGE_PREVIEW_CACHE_KEY);
    if (cached.data && !refresh) {
      if (cached.stale) {
        warmGenrePreviewCache(genres);
      }
      const response = respondOk(
        cached.data,
        {
          payloadMode: 'preview',
          providersUsed,
          cache: { hit: true, stale: cached.stale },
          status: cached.data.genres?.length ? 'ok' : 'empty',
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
      return response;
    }

    if (refresh) {
      const rebuiltGenres = await buildPreviewGenres(genres, providersUsed);
      const rebuiltPayload = { genres: rebuiltGenres };
      setCache(
        HOMEPAGE_PREVIEW_CACHE_KEY,
        rebuiltPayload,
        HOMEPAGE_PREVIEW_TTL_MS,
        HOMEPAGE_PREVIEW_STALE_MS
      );
      const response = respondOk(
        rebuiltPayload,
        {
          payloadMode: 'preview',
          providersUsed,
          cache: { hit: false },
          status: rebuiltGenres.length ? 'ok' : 'empty',
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
      return response;
    }

    // Cold-start fast path: return immediately and warm rich previews asynchronously.
    warmGenrePreviewCache(genres);
    const payload = {
      genres: genres.map((genre) => ({
        ...genre,
        previewArtists: genre.previewArtists || [],
        previewImageUrl: genre.previewImageUrl || undefined,
      })),
    };
    setCache(HOMEPAGE_PREVIEW_CACHE_KEY, payload, 10 * 1000, 2 * 60 * 1000);
    if (isDebugMode()) {
      logEvent('info', '[OffDaWallV2] api/genres preview fast-path', {
        success: true,
        count: payload.genres.length,
      });
    }
    const response = respondOk(
      payload,
      {
        payloadMode: 'preview',
        providersUsed,
        cache: { hit: false },
        status: 'partial',
        fallbackUsed: ['warming_preview'],
        emptyReason: 'warming_preview',
      }
    );
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
    return response;
  } catch (error) {
    logEvent('error', '[OffDaWallV2] api/genres', { success: false, error: `${error}` });
    return respondError(
      'genres_failed',
      'Failed to fetch genres',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}
