import { getFromCache, setCache, CACHE_TTL } from '@/lib/cache';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_HOSTS = [
  'coverartarchive.org',
  'archive.org',
  'theaudiodb.com',
  'last.fm',
  'lastfm.freetls.fastly.net',
  'lastfm-img2.akamaized.net',
  'userserve-ak.last.fm',
];

function isAllowedHost(host: string) {
  if (host.endsWith('.coverartarchive.org')) return true;
  if (host === 'archive.org' || host.endsWith('.archive.org')) return true;
  if (host === 'theaudiodb.com' || host.endsWith('.theaudiodb.com')) return true;
  if (host === 'last.fm' || host.endsWith('.last.fm')) return true;
  if (host.endsWith('.dzcdn.net')) return true;
  return ALLOWED_HOSTS.includes(host);
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      throw new Error('image_too_large');
    }
    return { buffer: Buffer.from(arrayBuffer), contentType };
  } finally {
    clearTimeout(timeout);
  }
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
    return new Response(cached.buffer, {
      status: 200,
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
      },
    });
  }

  try {
    const result = await fetchWithTimeout(target.toString(), 6000);
    setCache(cacheKey, result, CACHE_TTL.IMAGES);
    return new Response(result.buffer, {
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
