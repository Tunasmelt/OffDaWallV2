import { getAllGenres } from '@/lib/genres';
import { respondOk, respondError } from '@/lib/api-response';
import { isDebugMode, logEvent } from '@/lib/observability';
import { getArtistsForGenre } from '@/lib/services/aggregator';
import { normalizeImageUrl } from '@/lib/images';
import { resolveArtistImage as resolveArtistImageData } from '@/lib/services/image-resolver';
import { getFromCacheWithMeta, setCache, CACHE_TTL } from '@/lib/cache';
import { safeCall } from '@/lib/provider-safe';
import type { Genre } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const genres = getAllGenres();
    const providersUsed: string[] = [];
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === '1';

    if (!isPreview) {
      logEvent('info', '[OffDaWallV2] api/genres', { success: true });
      const response = respondOk(
        { genres },
        {
          payloadMode: 'preview',
          providersUsed,
          cache: { hit: false },
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');
      return response;
    }

    const cacheKey = 'genres:preview:v1';
    const cached = getFromCacheWithMeta<{ genres: Genre[] }>(cacheKey);
    if (cached.data) {
      const response = respondOk(
        cached.data,
        {
          payloadMode: 'preview',
          providersUsed,
          cache: { hit: true, stale: cached.stale },
        }
      );
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
      return response;
    }

    const concurrency = 3;
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
        let previewImageUrl =
          normalizeImageUrl(previewArtists.find((a) => a.imageUrl || a.image)?.imageUrl) ||
          normalizeImageUrl(previewArtists.find((a) => a.imageUrl || a.image)?.image);

        if (!previewImageUrl) {
          const candidate = previewArtists.find((a) => a.mbid || a.name);
          if (candidate) {
            const resolvedResult = await safeCall('image-resolver', () =>
              resolveArtistImageData({ mbid: candidate.mbid, name: candidate.name })
            );
            const resolved = resolvedResult.ok ? resolvedResult.data : null;
            previewImageUrl = normalizeImageUrl(resolved?.imageUrl);
            if (resolvedResult.ok && !providersUsed.includes('image-resolver')) {
              providersUsed.push('image-resolver');
            }
          }
        }

        results[currentIndex] = {
          ...current,
          previewArtists,
          previewImageUrl,
        };
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, genres.length) }, () => worker()));

    const payload = { genres: results };
    setCache(cacheKey, payload, 60 * 60 * 1000);
    if (isDebugMode()) {
      logEvent('info', '[OffDaWallV2] api/genres preview', { success: true, count: results.length });
    }
    const response = respondOk(
      payload,
      {
        payloadMode: 'preview',
        providersUsed,
        cache: { hit: false },
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
