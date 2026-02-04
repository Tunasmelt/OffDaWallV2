import { getFromCache, setCache, CACHE_TTL } from '@/lib/cache';
import { providerFetch } from '@/lib/providers/provider-fetch';
import type { ProviderName } from '@/lib/providers/provider-limits';

const MAX_BYTES = 8 * 1024 * 1024;
const inFlight = new Map<string, Promise<{ buffer: Buffer; contentType: string }>>();
const ALLOWED_HOSTS = [
  'coverartarchive.org',
  'archive.org',
  'theaudiodb.com',
  'last.fm',
  'lastfm.freetls.fastly.net',
  'lastfm-img2.akamaized.net',
  'userserve-ak.last.fm',
  'i.scdn.co',
];

function isAllowedHost(host: string) {
  if (host.endsWith('.coverartarchive.org')) return true;
  if (host === 'archive.org' || host.endsWith('.archive.org')) return true;
  if (host === 'theaudiodb.com' || host.endsWith('.theaudiodb.com')) return true;
  if (host === 'last.fm' || host.endsWith('.last.fm')) return true;
  if (host.endsWith('.dzcdn.net')) return true;
  if (host.endsWith('.scdn.co')) return true;
  return ALLOWED_HOSTS.includes(host);
}

function resolveProvider(hostname: string): ProviderName {
  if (hostname === 'archive.org' || hostname.endsWith('.archive.org')) return 'archiveorg';
  if (hostname.endsWith('.coverartarchive.org')) return 'coverart';
  if (hostname === 'coverartarchive.org') return 'coverart';
  if (hostname === 'theaudiodb.com' || hostname.endsWith('.theaudiodb.com')) return 'audiodb';
  if (hostname === 'last.fm' || hostname.endsWith('.last.fm')) return 'lastfm';
  if (hostname.endsWith('.dzcdn.net')) return 'deezer';
  if (hostname.endsWith('.scdn.co')) return 'spotify';
  return 'coverart';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url');
  if (!urlParam) {
    return new Response('Missing url', { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return new Response('Invalid url', { status: 400 });
  }

  if (!isAllowedHost(target.hostname)) {
    return new Response('Forbidden host', { status: 403 });
  }

  const cacheKey = `img-proxy:${target.toString()}`;
  const cached = getFromCache<{ buffer: Buffer; contentType: string }>(cacheKey);
  if (cached?.buffer) {
    return new Response(new Uint8Array(cached.buffer), {
      status: 200,
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
      },
    });
  }

  let inflightRequest = inFlight.get(cacheKey);
  if (!inflightRequest) {
    inflightRequest = (async () => {
      const provider = resolveProvider(target.hostname);
      const { response } = await providerFetch(provider, target.toString(), {
        timeoutMs: 6000,
        headers: { Accept: 'image/avif,image/webp,image/*,*/*' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_BYTES) {
        throw new Error('image_too_large');
      }
      const result = { buffer: Buffer.from(arrayBuffer), contentType };
      setCache(cacheKey, result, CACHE_TTL.IMAGES);
      return result;
    })().finally(() => {
      if (inFlight.get(cacheKey) === inflightRequest) {
        inFlight.delete(cacheKey);
      }
    });
    inFlight.set(cacheKey, inflightRequest);
  }

  try {
    const result = await inflightRequest;
    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
      },
    });
  } catch {
    return Response.redirect('/placeholder.svg', 302);
  }
}
