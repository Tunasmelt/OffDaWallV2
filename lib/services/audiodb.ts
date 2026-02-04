import type { Artist, AudioDBArtist } from '../types';
import { normalizeImageUrl } from '../images';
import { cache, CACHE_TTL } from '../cache';
import { providerFetchJson } from '../providers/provider-fetch';

const AUDIODB_API = 'https://www.theaudiodb.com/api/v1/json/2';

async function fetchAudioDB(endpoint: string): Promise<any> {
  const { data } = await providerFetchJson('audiodb', `${AUDIODB_API}${endpoint}`, {
    timeoutMs: 4500,
    headers: {
      Accept: 'application/json',
    },
  });
  return data;
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
      imageUrl: normalizeImageUrl(adb.strArtistThumb || adb.strArtistBanner),
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
      imageUrl: normalizeImageUrl(adb.strArtistThumb || adb.strArtistBanner),
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

