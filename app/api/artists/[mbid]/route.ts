import { NextRequest } from 'next/server';
import { getArtistProfile } from '@/lib/services/aggregator';
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

    if (!mbid) {
      return respondError(
        'missing_mbid',
        'Artist MBID is required',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        400
      );
    }

    logger.debug('[OffDaWallV2] Fetching artist profile for MBID:', mbid);

    const artistResult = await safeCall('aggregator', () => getArtistProfile(mbid));
    const artist = artistResult.ok ? artistResult.data : null;

    if (!artist) {
      logger.debug('[OffDaWallV2] Artist not found:', mbid);
      return respondError(
        'artist_not_found',
        'Artist not found',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        404
      );
    }

    logger.debug('[OffDaWallV2] Successfully fetched artist:', artist.name);

    const response = respondOk(
      artist,
      {
        payloadMode: 'preview',
        providersUsed: ['aggregator'],
        cache: { hit: false },
      }
    );
    response.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
    return response;
  } catch (error) {
    logger.error('[OffDaWallV2] Error fetching artist:', error);
    logEvent('error', '[OffDaWallV2] api/artists/[mbid]', { success: false, error: `${error}` });
    return respondError(
      'artist_failed',
      'Failed to fetch artist profile',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}

