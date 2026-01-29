import type { Track } from '../types';
import { normalizeImageUrl } from '../images';
import { fetchJson } from './http';

const LASTFM_API = 'https://ws.audioscrobbler.com/2.0/';

function getApiKey() {
  return process.env.LASTFM_API_KEY;
}

async function fetchLastFm(params: Record<string, string>): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const searchParams = new URLSearchParams({
    format: 'json',
    api_key: apiKey,
    ...params,
  });

  return fetchJson(`${LASTFM_API}?${searchParams.toString()}`, {}, {
    timeoutMs: 4500,
    retries: 1,
    headers: {
      Accept: 'application/json',
    },
  });
}

export async function getAlbumInfoByMbid(mbid: string) {
  try {
    const data = await fetchLastFm({
      method: 'album.getInfo',
      mbid,
    });
    return data?.album || null;
  } catch {
    return null;
  }
}

export async function getAlbumInfoByArtistTitle(artist: string, album: string) {
  try {
    const data = await fetchLastFm({
      method: 'album.getInfo',
      artist,
      album,
    });
    return data?.album || null;
  } catch {
    return null;
  }
}

export async function getArtistInfoByMbid(mbid: string) {
  try {
    const data = await fetchLastFm({
      method: 'artist.getInfo',
      mbid,
    });
    return data?.artist || null;
  } catch {
    return null;
  }
}

export async function getArtistInfoByName(artist: string) {
  try {
    const data = await fetchLastFm({
      method: 'artist.getInfo',
      artist,
    });
    return data?.artist || null;
  } catch {
    return null;
  }
}

export function extractTracksFromAlbumInfo(albumInfo: any): Track[] {
  const tracks = albumInfo?.tracks?.track;
  if (!tracks) return [];

  const list = Array.isArray(tracks) ? tracks : [tracks];
  return list.map((t: any, idx: number) => ({
    id: t.mbid || `lastfm:${t.name}:${idx}`,
    title: t.name,
    artistName: t.artist?.name || albumInfo?.artist || '',
    duration: t.duration ? Math.round(Number(t.duration)) : undefined,
  }));
}

export function extractAlbumImage(albumInfo: any): string | undefined {
  const images = albumInfo?.image;
  if (!images) return undefined;
  const list = Array.isArray(images) ? images : [images];
  const preferred = list.find((i: any) => i.size === 'extralarge' || i.size === 'mega') || list[list.length - 1];
  return normalizeImageUrl(preferred?.['#text']);
}

export function extractArtistImage(artistInfo: any): string | undefined {
  const images = artistInfo?.image;
  if (!images) return undefined;
  const list = Array.isArray(images) ? images : [images];
  const preferred = list.find((i: any) => i.size === 'extralarge' || i.size === 'mega') || list[list.length - 1];
  return normalizeImageUrl(preferred?.['#text']);
}

export function extractArtistBio(artistInfo: any): string | undefined {
  const content = artistInfo?.bio?.content || artistInfo?.bio?.summary;
  if (!content) return undefined;
  return String(content).replace(/\s+\n/g, '\n').trim();
}
