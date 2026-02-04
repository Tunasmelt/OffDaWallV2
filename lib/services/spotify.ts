import { cache, CACHE_TTL } from '../cache';
import { normalizeImageUrl } from '../images';
import { providerFetch } from '../providers/provider-fetch';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API = 'https://api.spotify.com/v1';

export type SpotifyArtist = {
  id: string;
  name: string;
  popularity?: number;
  followers?: { total: number };
  genres?: string[];
  images?: Array<{ url: string; width: number; height: number }>;
};

export type SpotifyTrack = {
  id: string;
  name: string;
  preview_url?: string | null;
  external_urls?: { spotify?: string };
  album?: { name?: string; images?: Array<{ url: string; width: number; height: number }> };
  artists?: Array<{ id: string; name: string }>;
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

const TOKEN_CACHE_KEY = 'spotify:token';
const NO_ARTIST_SENTINEL = '__none__';
const NO_TRACKS_SENTINEL = '__none_tracks__';
const SPOTIFY_ARTIST_TTL_MS = 6 * 60 * 60 * 1000;
const SPOTIFY_TRACKS_TTL_MS = 2 * 60 * 60 * 1000;
const SPOTIFY_NEGATIVE_TTL_MS = 15 * 60 * 1000;

function getMarket() {
  return process.env.SPOTIFY_MARKET || 'US';
}

export async function getSpotifyAccessToken(): Promise<string | null> {
  const cached = cache.get<TokenCache>(TOKEN_CACHE_KEY);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const { response: res } = await providerFetch('spotify', SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    timeoutMs: 4000,
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  const expiresAt = Date.now() + Math.max(data.expires_in - 30, 60) * 1000;
  cache.set(TOKEN_CACHE_KEY, { token: data.access_token, expiresAt }, data.expires_in * 1000);
  return data.access_token;
}

async function spotifyFetchJson<T>(
  url: string,
  { retryOn401 = true }: { retryOn401?: boolean } = {}
): Promise<T> {
  let token = await getSpotifyAccessToken();
  if (!token) {
    throw new Error('spotify_missing_token');
  }

  try {
    const { response: res } = await providerFetch('spotify', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      timeoutMs: 6000,
    });

    if (res.status === 401 && retryOn401) {
      cache.delete(TOKEN_CACHE_KEY);
      token = await getSpotifyAccessToken();
      if (!token) {
        throw new Error('spotify_token_refresh_failed');
      }
      return spotifyFetchJson<T>(url, { retryOn401: false });
    }

    if (!res.ok) {
      throw new Error(`spotify_http_${res.status}`);
    }

    return (await res.json()) as T;
  } finally {
    // providerFetch enforces timeout/retry; nothing extra to cleanup
  }
}

export async function searchArtistByName(name: string): Promise<SpotifyArtist | null> {
  const cacheKey = `spotify:artist:${name.toLowerCase()}`;
  const cached = cache.get<SpotifyArtist | typeof NO_ARTIST_SENTINEL>(cacheKey);
  if (cached === NO_ARTIST_SENTINEL) {
    return null;
  }
  if (cached) {
    return cached;
  }

  const data = await spotifyFetchJson<{ artists: { items: SpotifyArtist[] } }>(
    `${SPOTIFY_API}/search?type=artist&limit=1&q=${encodeURIComponent(name)}`
  );
  const artist = data?.artists?.items?.[0] || null;
  if (artist) {
    cache.set(cacheKey, artist, SPOTIFY_ARTIST_TTL_MS);
  } else {
    cache.set(cacheKey, NO_ARTIST_SENTINEL, SPOTIFY_NEGATIVE_TTL_MS);
  }
  return artist;
}

export async function getArtist(id: string): Promise<SpotifyArtist | null> {
  const cacheKey = `spotify:artist:id:${id}`;
  const cached = cache.get<SpotifyArtist | typeof NO_ARTIST_SENTINEL>(cacheKey);
  if (cached === NO_ARTIST_SENTINEL) return null;
  if (cached) return cached;

  const artist = await spotifyFetchJson<SpotifyArtist>(`${SPOTIFY_API}/artists/${id}`);
  if (artist) {
    cache.set(cacheKey, artist, SPOTIFY_ARTIST_TTL_MS);
    return artist;
  }
  cache.set(cacheKey, NO_ARTIST_SENTINEL, SPOTIFY_NEGATIVE_TTL_MS);
  return null;
}

export async function getArtistTopTracks(id: string, market: string = getMarket()): Promise<SpotifyTrack[]> {
  const cacheKey = `spotify:top:${id}:${market}`;
  const cached = cache.get<SpotifyTrack[] | typeof NO_TRACKS_SENTINEL>(cacheKey);
  if (cached === NO_TRACKS_SENTINEL) return [];
  if (cached) return cached;

  const data = await spotifyFetchJson<{ tracks: SpotifyTrack[] }>(
    `${SPOTIFY_API}/artists/${id}/top-tracks?market=${encodeURIComponent(market)}`
  );
  const tracks = data?.tracks || [];
  if (tracks.length) {
    cache.set(cacheKey, tracks, SPOTIFY_TRACKS_TTL_MS);
  } else {
    cache.set(cacheKey, NO_TRACKS_SENTINEL, SPOTIFY_NEGATIVE_TTL_MS);
  }
  return tracks;
}

export async function searchTrack(query: string): Promise<SpotifyTrack | null> {
  const cacheKey = `spotify:track:${query.toLowerCase()}`;
  const cached = cache.get<SpotifyTrack | typeof NO_TRACKS_SENTINEL>(cacheKey);
  if (cached === NO_TRACKS_SENTINEL) return null;
  if (cached) return cached;

  const data = await spotifyFetchJson<{ tracks: { items: SpotifyTrack[] } }>(
    `${SPOTIFY_API}/search?type=track&limit=1&q=${encodeURIComponent(query)}`
  );
  const track = data?.tracks?.items?.[0] || null;
  if (track) {
    cache.set(cacheKey, track, CACHE_TTL.CATALOG);
  } else {
    cache.set(cacheKey, NO_TRACKS_SENTINEL, SPOTIFY_NEGATIVE_TTL_MS);
  }
  return track;
}

export function extractArtistImage(artist: SpotifyArtist | null): string | undefined {
  if (!artist?.images?.length) return undefined;
  return normalizeImageUrl(artist.images[0]?.url);
}

export function extractArtistGenres(artist: SpotifyArtist | null): string[] {
  return artist?.genres || [];
}

export function extractArtistPopularity(artist: SpotifyArtist | null): number | undefined {
  return artist?.popularity;
}
