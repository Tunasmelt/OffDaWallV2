import type { Track, DeezerArtist, DeezerTrack } from '../types';
import { cache, CACHE_TTL } from '../cache';
import { deezerLimiter } from '../rate-limiter';

const DEEZER_API = 'https://api.deezer.com';

async function fetchDeezer(endpoint: string): Promise<any> {
  await deezerLimiter.waitForSlot();

  const response = await fetch(`${DEEZER_API}${endpoint}`);

  if (!response.ok) {
    throw new Error(`Deezer API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function searchArtist(name: string): Promise<DeezerArtist | null> {
  const cacheKey = `deezer:artist:${name}`;
  const cached = cache.get<DeezerArtist>(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    const data = await fetchDeezer(`/search/artist?q=${encodeURIComponent(name)}&limit=1`);

    if (!data.data || data.data.length === 0) {
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

    if (!data.data) {
      return [];
    }

    const tracks: Track[] = data.data.map((dt: DeezerTrack) => ({
      id: `deezer:${dt.id}`,
      title: dt.title,
      artistName: dt.artist.name,
      albumTitle: dt.album.title,
      duration: dt.duration,
      releaseDate: dt.release_date,
      previewUrl: dt.preview,
      popularity: dt.id, // Deezer doesn't expose direct popularity
    }));

    cache.set(cacheKey, tracks, CACHE_TTL.CATALOG);
    return tracks;
  } catch (error) {
    console.error('[OffDaWallV2] Deezer tracks fetch error:', error);
    return [];
  }
}

