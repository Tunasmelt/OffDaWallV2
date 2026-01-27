import type { Artist, AudioDBArtist } from '../types';
import { cache, CACHE_TTL } from '../cache';
import { audioDBLimiter } from '../rate-limiter';

const AUDIODB_API = 'https://www.theaudiodb.com/api/v1/json/2';

async function fetchAudioDB(endpoint: string): Promise<any> {
  await audioDBLimiter.waitForSlot();

  const response = await fetch(`${AUDIODB_API}${endpoint}`);

  if (!response.ok) {
    throw new Error(`AudioDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getArtistByMBID(mbid: string): Promise<Partial<Artist> | null> {
  const cacheKey = `audiodb:artist:${mbid}`;
  const cached = cache.get<Partial<Artist>>(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    const data = await fetchAudioDB(`/artist-mb.php?i=${mbid}`);

    if (!data.artists || data.artists.length === 0) {
      return null;
    }

    const adb: AudioDBArtist = data.artists[0];

    const artistData: Partial<Artist> = {
      imageUrl: adb.strArtistThumb || adb.strArtistBanner,
      bio: adb.strBiographyEN,
      website: adb.strWebsite,
      facebook: adb.strFacebook,
      twitter: adb.strTwitter,
    };

    cache.set(cacheKey, artistData, CACHE_TTL.IMAGES);
    return artistData;
  } catch (error) {
    console.error('[OffDaWallV2] AudioDB fetch error:', error);
    return null;
  }
}

export async function searchArtistByName(name: string): Promise<Partial<Artist> | null> {
  const cacheKey = `audiodb:search:${name}`;
  const cached = cache.get<Partial<Artist>>(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    const data = await fetchAudioDB(`/search.php?s=${encodeURIComponent(name)}`);

    if (!data.artists || data.artists.length === 0) {
      return null;
    }

    const adb: AudioDBArtist = data.artists[0];

    const artistData: Partial<Artist> = {
      imageUrl: adb.strArtistThumb || adb.strArtistBanner,
      bio: adb.strBiographyEN,
      website: adb.strWebsite,
      facebook: adb.strFacebook,
      twitter: adb.strTwitter,
    };

    cache.set(cacheKey, artistData, CACHE_TTL.IMAGES);
    return artistData;
  } catch (error) {
    console.error('[OffDaWallV2] AudioDB search error:', error);
    return null;
  }
}

