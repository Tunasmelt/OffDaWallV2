import { requireAdmin } from '@/lib/api-guard';
import { respondOk, respondError } from '@/lib/api-response';
import { addProviderTiming, logRouteResult, routeMeta, startRouteTrace } from '@/lib/observability';
import { providerFetch, getProviderLimiterStatus } from '@/lib/providers/provider-fetch';
import { PROVIDER_LIMITS } from '@/lib/providers/provider-limits';
import * as Spotify from '@/lib/services/spotify';

export async function GET(request: Request) {
  const trace = startRouteTrace('api/health');
  const auth = requireAdmin(request);
  if (!auth.ok) {
    return respondError(
      'unauthorized',
      auth.message || 'Unauthorized',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false }, ...routeMeta(trace) },
      auth.status
    );
  }

  const lastFmKey = process.env.LASTFM_API_KEY;
  const spotifyConfigured = Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

  const [musicBrainz, audioDb, deezer, lastfm, spotify] = await Promise.all([
    providerFetch(
      'musicbrainz',
      'https://musicbrainz.org/ws/2/artist?query=artist:eminem&limit=1&fmt=json',
      { timeoutMs: 4000 }
    ).then(({ response, meta }) => {
      addProviderTiming(trace, 'musicbrainz', meta.durationMs);
      return ({
      ok: response.ok,
      status: response.status,
      latencyMs: meta.durationMs,
    })}).catch((error: any) => ({
      ok: false,
      status: 0,
      latencyMs: error?.meta?.durationMs || 0,
      error: error?.message || 'fetch_failed',
    })),
    providerFetch(
      'audiodb',
      'https://www.theaudiodb.com/api/v1/json/2/search.php?s=eminem',
      { timeoutMs: 4000 }
    ).then(({ response, meta }) => {
      addProviderTiming(trace, 'audiodb', meta.durationMs);
      return ({
      ok: response.ok,
      status: response.status,
      latencyMs: meta.durationMs,
    })}).catch((error: any) => ({
      ok: false,
      status: 0,
      latencyMs: error?.meta?.durationMs || 0,
      error: error?.message || 'fetch_failed',
    })),
    providerFetch(
      'deezer',
      'https://api.deezer.com/artist/27',
      { timeoutMs: 4000 }
    ).then(({ response, meta }) => {
      addProviderTiming(trace, 'deezer', meta.durationMs);
      return ({
      ok: response.ok,
      status: response.status,
      latencyMs: meta.durationMs,
    })}).catch((error: any) => ({
      ok: false,
      status: 0,
      latencyMs: error?.meta?.durationMs || 0,
      error: error?.message || 'fetch_failed',
    })),
    lastFmKey
      ? providerFetch(
          'lastfm',
          `https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=Eminem&api_key=${lastFmKey}&format=json`,
          { timeoutMs: 4000 }
        ).then(({ response, meta }) => {
          addProviderTiming(trace, 'lastfm', meta.durationMs);
          return ({
          ok: response.ok,
          status: response.status,
          latencyMs: meta.durationMs,
        })}).catch((error: any) => ({
          ok: false,
          status: 0,
          latencyMs: error?.meta?.durationMs || 0,
          error: error?.message || 'fetch_failed',
        }))
      : {
          ok: false,
          status: 0,
          latencyMs: 0,
          error: 'missing_api_key',
        },
    spotifyConfigured
      ? (async () => {
          const tokenStart = Date.now();
          const token = await Spotify.getSpotifyAccessToken();
          const tokenLatency = Date.now() - tokenStart;
          addProviderTiming(trace, 'spotify', tokenLatency);
          if (!token) {
            return {
              ok: false,
              status: 0,
              latencyMs: tokenLatency,
              tokenOk: false,
              error: 'token_fetch_failed',
            };
          }
          const searchStart = Date.now();
          const artist = await Spotify.searchArtistByName('Eminem');
          const searchLatency = Date.now() - searchStart;
          addProviderTiming(trace, 'spotify', searchLatency);
          return {
            ok: Boolean(artist),
            status: artist ? 200 : 404,
            latencyMs: tokenLatency + searchLatency,
            tokenOk: true,
            searchOk: Boolean(artist),
          };
        })().catch((error: any) => ({
          ok: false,
          status: 0,
          latencyMs: 0,
          tokenOk: false,
          error: error?.message || 'fetch_failed',
        }))
      : Promise.resolve({
          ok: false,
          status: 0,
          latencyMs: 0,
          tokenOk: false,
          error: 'missing_api_key',
        }),
  ]);

  const payload = {
    ok: musicBrainz.ok && audioDb.ok && deezer.ok && (lastFmKey ? lastfm.ok : true) && (spotifyConfigured ? spotify.ok : true),
    timestamp: Date.now(),
    services: {
      musicbrainz: musicBrainz,
      audiodb: audioDb,
      deezer: deezer,
      lastfm: lastFmKey ? lastfm : { ok: false, status: 0, latencyMs: 0, error: 'missing_api_key' },
      spotify: spotify,
    },
    rateLimit: {
      musicbrainz: { ...PROVIDER_LIMITS.musicbrainz, ...getProviderLimiterStatus('musicbrainz') },
      audiodb: { ...PROVIDER_LIMITS.audiodb, ...getProviderLimiterStatus('audiodb') },
      deezer: { ...PROVIDER_LIMITS.deezer, ...getProviderLimiterStatus('deezer') },
      lastfm: lastFmKey
        ? { ...PROVIDER_LIMITS.lastfm, ...getProviderLimiterStatus('lastfm') }
        : { supported: false },
      spotify: { ...PROVIDER_LIMITS.spotify, ...getProviderLimiterStatus('spotify') },
      coverart: { ...PROVIDER_LIMITS.coverart, ...getProviderLimiterStatus('coverart') },
      archiveorg: { ...PROVIDER_LIMITS.archiveorg, ...getProviderLimiterStatus('archiveorg') },
    },
  };

  const res = respondOk(
    payload,
    {
      payloadMode: 'preview',
      providersUsed: ['musicbrainz', 'audiodb', 'deezer', 'lastfm', 'spotify'],
      cache: { hit: false },
      ...routeMeta(trace),
    }
  );
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  res.headers.set('Pragma', 'no-cache');
  if (!payload.ok) {
    res.headers.set('x-health-status', 'degraded');
  }
  logRouteResult('info', trace, { success: payload.ok, status: payload.ok ? 'ok' : 'partial' });
  return res;
}
