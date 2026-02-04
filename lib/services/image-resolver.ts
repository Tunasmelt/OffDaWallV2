import { normalizeImageUrl, toImageProxyUrl } from '../images';
import { CACHE_TTL, getFromCache, setCache } from '../cache';
import * as AudioDB from './audiodb';
import * as LastFm from './lastfm';
import * as Deezer from './deezer';
import * as MusicBrainz from './musicbrainz';
import { getCoverArtUrlForReleaseGroup } from './coverart';
import * as Spotify from './spotify';
import { safeCall } from '../provider-safe';

type ImageSource = 'audiodb' | 'spotify' | 'lastfm' | 'deezer' | 'coverart' | 'none';

type ImageResolveResult = {
  imageUrl: string | null;
  source: ImageSource;
  license?: string;
  confidence: number;
};

const NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label}_timeout`));
    }, timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timeout));
  });
}

export async function getArtistCoverArtFallback(mbid: string): Promise<string | null> {
  const cacheKey = `artist-coverart:${mbid}`;
  const cached = getFromCache<string | null>(cacheKey);
  if (cached !== null) {
    return cached || null;
  }

  const releaseGroupsResult = await safeCall('musicbrainz', () =>
    withTimeout(MusicBrainz.getArtistReleases(mbid, 5), PROVIDER_TIMEOUT_MS, 'musicbrainz')
  );
  const releaseGroups = releaseGroupsResult.ok ? releaseGroupsResult.data : [];
  for (const group of releaseGroups) {
    const coverResult = await safeCall('coverart', () =>
      withTimeout(
        getCoverArtUrlForReleaseGroup(group.releaseGroupMbid || group.mbid),
        PROVIDER_TIMEOUT_MS,
        'coverart'
      )
    );
    const cover = coverResult.ok ? coverResult.data : null;
    const normalized = toImageProxyUrl(cover);
    if (normalized) {
      setCache(cacheKey, normalized, CACHE_TTL.IMAGES);
      return normalized;
    }
  }

  setCache(cacheKey, null, NEGATIVE_TTL_MS);
  return null;
}

export async function resolveArtistImage(params: { mbid?: string; name?: string }): Promise<ImageResolveResult> {
  const key = params.mbid || params.name?.toLowerCase() || '';
  if (!key) {
    return { imageUrl: null, source: 'none', confidence: 0 };
  }

  const cacheKey = `artist-image:resolve:${key}`;
  const cached = getFromCache<ImageResolveResult>(cacheKey);
  if (cached) {
    return cached;
  }

  let imageUrl: string | null = null;
  let source: ImageSource = 'none';
  let confidence = 0;

  if (params.mbid) {
    const mbid = params.mbid;
    const audioDbResult = await safeCall('audiodb', () =>
      withTimeout(AudioDB.getArtistByMBID(mbid), PROVIDER_TIMEOUT_MS, 'audiodb')
    );
    const audioDbData = audioDbResult.ok ? audioDbResult.data : null;
    const normalized = normalizeImageUrl(audioDbData?.imageUrl);
    if (normalized) {
      imageUrl = normalized;
      source = 'audiodb';
      confidence = 0.9;
    }
  }

  if (!imageUrl && params.name) {
    const artistName = params.name;
    const audioDbResult = await safeCall('audiodb', () =>
      withTimeout(AudioDB.searchArtistByName(artistName), PROVIDER_TIMEOUT_MS, 'audiodb')
    );
    const audioDbData = audioDbResult.ok ? audioDbResult.data : null;
    const normalized = normalizeImageUrl(audioDbData?.imageUrl);
    if (normalized) {
      imageUrl = normalized;
      source = 'audiodb';
      confidence = 0.85;
    }
  }

  if (
    !imageUrl &&
    params.name &&
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET
  ) {
    const artistName = params.name;
    const spotifyResult = await safeCall('spotify', () =>
      withTimeout(Spotify.searchArtistByName(artistName), PROVIDER_TIMEOUT_MS, 'spotify')
    );
    const spotifyArtist = spotifyResult.ok ? spotifyResult.data : null;
    const images = spotifyArtist?.images || [];
    const bestImage = images.reduce<{ url: string } | null>((best, current) => {
      if (!current?.url) return best;
      if (!best) return current;
      return (current.width || 0) > ((best as any).width || 0) ? current : best;
    }, null);
    const spotifyImage = normalizeImageUrl(bestImage?.url || Spotify.extractArtistImage(spotifyArtist));
    if (spotifyImage) {
      imageUrl = spotifyImage;
      source = 'spotify';
      confidence = 0.8;
    }
  }

  if (!imageUrl && process.env.LASTFM_API_KEY) {
    const lfInfoResult = await safeCall('lastfm', () =>
      withTimeout(
        params.mbid
          ? LastFm.getArtistInfoByMbid(params.mbid)
          : params.name
            ? LastFm.getArtistInfoByName(params.name)
            : Promise.resolve(null),
        PROVIDER_TIMEOUT_MS,
        'lastfm'
      )
    );
    const lfInfo = lfInfoResult.ok ? lfInfoResult.data : null;
    const lfImage = normalizeImageUrl(LastFm.extractArtistImage(lfInfo));
    if (lfImage) {
      imageUrl = lfImage;
      source = 'lastfm';
      confidence = 0.7;
    }
  }

  if (!imageUrl && params.name) {
    const artistName = params.name;
    const deezerResult = await safeCall('deezer', () =>
      withTimeout(Deezer.searchArtist(artistName), PROVIDER_TIMEOUT_MS, 'deezer')
    );
    const deezerArtist = deezerResult.ok ? deezerResult.data : null;
    const deezerImage = normalizeImageUrl(deezerArtist?.picture_big || deezerArtist?.picture_medium);
    if (deezerImage) {
      imageUrl = deezerImage;
      source = 'deezer';
      confidence = 0.6;
    }
  }

  if (!imageUrl && params.mbid) {
    const cover = await getArtistCoverArtFallback(params.mbid);
    if (cover) {
      imageUrl = toImageProxyUrl(cover) || cover;
      source = 'coverart';
      confidence = 0.4;
    }
  }

  if (imageUrl) {
    imageUrl = toImageProxyUrl(imageUrl) || imageUrl;
  }

  const result: ImageResolveResult = {
    imageUrl,
    source,
    confidence,
  };

  setCache(cacheKey, result, imageUrl ? CACHE_TTL.IMAGES : NEGATIVE_TTL_MS);
  return result;
}
