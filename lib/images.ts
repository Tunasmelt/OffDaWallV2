export function normalizeImageUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '#') return undefined;
  if (trimmed.startsWith('/placeholder')) return undefined;
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('http://')) return `https://${trimmed.slice('http://'.length)}`;
  if (trimmed.startsWith('https://') || trimmed.startsWith('/')) return trimmed;
  return `https://${trimmed}`;
}

export function resolveArtistImage(imageUrl?: string | null, image?: string | null) {
  return normalizeImageUrl(imageUrl) || normalizeImageUrl(image);
}

const PROXY_HOSTS = [
  'coverartarchive.org',
  'archive.org',
  'theaudiodb.com',
  'last.fm',
  'lastfm.freetls.fastly.net',
  'lastfm-img2.akamaized.net',
  'userserve-ak.last.fm',
];

function shouldProxyHost(host: string) {
  if (host.endsWith('.coverartarchive.org')) return true;
  if (host === 'archive.org' || host.endsWith('.archive.org')) return true;
  if (host === 'theaudiodb.com' || host.endsWith('.theaudiodb.com')) return true;
  if (host === 'last.fm' || host.endsWith('.last.fm')) return true;
  if (host.endsWith('.dzcdn.net')) return true;
  if (PROXY_HOSTS.includes(host)) return true;
  return false;
}

export function toImageProxyUrl(value?: string | null): string | undefined {
  const normalized = normalizeImageUrl(value);
  if (!normalized || normalized.startsWith('/')) {
    return normalized;
  }
  try {
    const url = new URL(normalized);
    if (shouldProxyHost(url.hostname)) {
      return `/api/image-proxy?url=${encodeURIComponent(normalized)}`;
    }
  } catch {
    return normalized;
  }
  return normalized;
}
