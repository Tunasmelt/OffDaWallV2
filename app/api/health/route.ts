import { audioDBLimiter, deezerLimiter, musicBrainzLimiter } from '@/lib/rate-limiter';
import { requireAdmin } from '@/lib/api-guard';
import { respondOk, respondError } from '@/lib/api-response';
import { logEvent } from '@/lib/observability';

const USER_AGENT = 'OffDaWall/1.0.0 (http://localhost)';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 4000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      error: error?.name || error?.message || 'fetch_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const auth = requireAdmin(request);
  if (!auth.ok) {
    return respondError(
      'unauthorized',
      auth.message || 'Unauthorized',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      auth.status
    );
  }

  const lastFmKey = process.env.LASTFM_API_KEY;

  const [musicBrainz, audioDb, deezer, lastfm] = await Promise.all([
    fetchWithTimeout(
      'https://musicbrainz.org/ws/2/artist?query=artist:eminem&limit=1&fmt=json',
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      },
      4000
    ),
    fetchWithTimeout(
      'https://www.theaudiodb.com/api/v1/json/2/search.php?s=eminem',
      {},
      4000
    ),
    fetchWithTimeout(
      'https://api.deezer.com/artist/27',
      {},
      4000
    ),
    lastFmKey
      ? fetchWithTimeout(
          `https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=Eminem&api_key=${lastFmKey}&format=json`,
          {},
          4000
        )
      : {
          ok: false,
          status: 0,
          latencyMs: 0,
          error: 'missing_api_key',
        },
  ]);

  const payload = {
    ok: musicBrainz.ok && audioDb.ok && deezer.ok && (lastFmKey ? lastfm.ok : true),
    timestamp: Date.now(),
    services: {
      musicbrainz: musicBrainz,
      audiodb: audioDb,
      deezer: deezer,
      lastfm: lastfmKey ? lastfm : { ok: false, status: 0, latencyMs: 0, error: 'missing_api_key' },
    },
    rateLimit: {
      musicbrainz: musicBrainzLimiter.getStatus(),
      audiodb: audioDBLimiter.getStatus(),
      deezer: deezerLimiter.getStatus(),
      lastfm: { supported: false },
    },
  };

  const res = respondOk(
    payload,
    { payloadMode: 'preview', providersUsed: ['musicbrainz', 'audiodb', 'deezer', 'lastfm'], cache: { hit: false } }
  );
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  res.headers.set('Pragma', 'no-cache');
  if (!payload.ok) {
    res.headers.set('x-health-status', 'degraded');
  }
  logEvent('info', '[OffDaWallV2] api/health', { success: payload.ok });
  return res;
}
