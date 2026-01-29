import type { Track, DeezerArtist, DeezerTrack } from '../types';
import { cache, CACHE_TTL } from '../cache';
import { deezerLimiter } from '../rate-limiter';
import { normalizeImageUrl } from '../images';
import { fetchJson } from './http';

const DEEZER_API = 'https://api.deezer.com';
const RATE_LIMIT_COOLDOWN_MS = 30_000;
let cooldownUntil = 0;

async function fetchDeezer(endpoint: string): Promise<any | null> {
  if (Date.now() < cooldownUntil) {
    return null;
  }
  try {
    await deezerLimiter.waitForSlot();
  } catch (error) {
    if (`${error}`.includes('Rate limiter wait exceeded')) {
      cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      return null;
    }
    throw error;
  }

  return fetchJson(`${DEEZER_API}${endpoint}`, {}, {
    timeoutMs: 4500,
    retries: 1,
    headers: {
      Accept: 'application/json',
    },
  });
}

export async function searchArtist(name: string): Promise<DeezerArtist | null> {
  const cacheKey = `deezer:artist:${name}`;
  const cached = cache.get<DeezerArtist>(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    const data = await fetchDeezer(`/search/artist?q=${encodeURIComponent(name)}&limit=1`);

    if (!data?.data || data.data.length === 0) {
      return null;
    }

    const artist = data.data[0];
    cache.set(cacheKey, artist, CACHE_TTL.ARTIST_DATA);
    return artist;
  } catch (error) {
    console.error('[OffDaWallV2] Deezer artist search error:', error);
    return null;
  }
}

export async function getArtistTopTracks(artistId: number, limit: number = 50): Promise<Track[]> {
  const cacheKey = `deezer:tracks:${artistId}:${limit}`;
  const cached = cache.get<Track[]>(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    const data = await fetchDeezer(`/artist/${artistId}/top?limit=${limit}`);

    if (!data?.data) {
      return [];
    }

    const tracks: Track[] = data.data.map((dt: DeezerTrack) => ({
      id: `deezer:${dt.id}`,
      title: dt.title,
      artistName: dt.artist.name,
      albumTitle: dt.album.title,
      albumArt: normalizeImageUrl(dt.album.cover_medium || dt.album.cover),
      duration: dt.duration,
      releaseDate: dt.release_date,
      previewUrl: dt.preview,
      popularity: dt.rank || undefined,
      rank: dt.rank || undefined,
      playCount: dt.rank || undefined,
    }));

    cache.set(cacheKey, tracks, CACHE_TTL.CATALOG);
    return tracks;
  } catch (error) {
    console.error('[OffDaWallV2] Deezer tracks fetch error:', error);
    return [];
  }
}

export async function searchTrack(artistName: string, trackTitle: string): Promise<Track | null> {
  const cacheKey = `deezer:track:${artistName}:${trackTitle}`;
  const cached = cache.get<Track>(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const query = `artist:"${artistName}" track:"${trackTitle}"`;
    const data = await fetchDeezer(`/search/track?q=${encodeURIComponent(query)}&limit=1`);

    if (!data?.data || data.data.length === 0) {
      return null;
    }

    const dt: DeezerTrack = data.data[0];
    const track: Track = {
      id: `deezer:${dt.id}`,
      title: dt.title,
      artistName: dt.artist.name,
      albumTitle: dt.album.title,
      albumArt: normalizeImageUrl(dt.album.cover_medium || dt.album.cover),
      duration: dt.duration,
      releaseDate: dt.release_date,
      previewUrl: dt.preview,
      popularity: dt.rank || undefined,
      rank: dt.rank || undefined,
      playCount: dt.rank || undefined,
    };

    cache.set(cacheKey, track, CACHE_TTL.CATALOG);
    return track;
  } catch (error) {
    console.error('[OffDaWallV2] Deezer track search error:', error);
    return null;
  }
}

