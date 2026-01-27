import type { Artist, Album, MusicBrainzArtist, MusicBrainzRelease } from '../types';
import { cache, CACHE_TTL } from '../cache';
import { musicBrainzLimiter } from '../rate-limiter';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'OffDaWall/1.0.0 (https://offdawall.app)';

async function fetchMusicBrainz(endpoint: string): Promise<any> {
  await musicBrainzLimiter.waitForSlot();

  const response = await fetch(`${MUSICBRAINZ_API}${endpoint}`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function searchArtists(query: string, genreFilter?: string[], limit: number = 50): Promise<Artist[]> {
  const cacheKey = `mb:search:${query}:${genreFilter?.join(',') || 'all'}:${limit}`;
  const cached = cache.get<Artist[]>(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    // Build search query
    let searchQuery = `artist:"${query}"`;
    
    if (genreFilter && genreFilter.length > 0) {
      const tagQuery = genreFilter.map(tag => `tag:"${tag}"`).join(' OR ');
      searchQuery += ` AND (${tagQuery})`;
    }
    
    const data = await fetchMusicBrainz(
      `/artist?query=${encodeURIComponent(searchQuery)}&limit=${limit}&fmt=json`
    );

    const artists: Artist[] = (data.artists || []).map((mb: MusicBrainzArtist) => ({
      mbid: mb.id,
      name: mb.name,
      sortName: mb['sort-name'],
      disambiguation: mb.disambiguation,
      type: mb.type,
      country: mb.country,
      area: mb.area?.name,
      beginDate: mb['life-span']?.begin,
      endDate: mb['life-span']?.end,
      genres: [],
      tags: mb.tags?.map(t => t.name) || [],
    }));

    cache.set(cacheKey, artists, CACHE_TTL.SEARCH);
    return artists;
  } catch (error) {
    console.error('[OffDaWallV2] MusicBrainz search error:', error);
    return [];
  }
}

export async function searchArtistsByTags(tags: string[], limit: number = 20): Promise<Artist[]> {
  const cacheKey = `mb:artists:${tags.join(',')}:${limit}`;
  const cached = cache.get<Artist[]>(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    // Build query with tags
    const tagQuery = tags.map(tag => `tag:"${tag}"`).join(' OR ');
    const query = `${tagQuery} AND type:group AND type:person`;
    
    const data = await fetchMusicBrainz(
      `/artist?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`
    );

    const artists: Artist[] = (data.artists || []).map((mb: MusicBrainzArtist) => ({
      mbid: mb.id,
      name: mb.name,
      sortName: mb['sort-name'],
      disambiguation: mb.disambiguation,
      type: mb.type,
      country: mb.country,
      area: mb.area?.name,
      beginDate: mb['life-span']?.begin,
      endDate: mb['life-span']?.end,
      genres: [],
      tags: mb.tags?.map(t => t.name) || [],
    }));

    cache.set(cacheKey, artists, CACHE_TTL.GENRE_DATA);
    return artists;
  } catch (error) {
    console.error('[OffDaWallV2] MusicBrainz search error:', error);
    return [];
  }
}

export async function getArtistById(mbid: string): Promise<Artist | null> {
  const cacheKey = `mb:artist:${mbid}`;
  const cached = cache.get<Artist>(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    const data = await fetchMusicBrainz(
      `/artist/${mbid}?inc=tags+ratings+genres&fmt=json`
    );

    const artist: Artist = {
      mbid: data.id,
      name: data.name,
      sortName: data['sort-name'],
      disambiguation: data.disambiguation,
      type: data.type,
      country: data.country,
      area: data.area?.name,
      beginDate: data['life-span']?.begin,
      endDate: data['life-span']?.end,
      genres: data.genres?.map((g: any) => g.name) || [],
      tags: data.tags?.map((t: any) => t.name) || [],
    };

    cache.set(cacheKey, artist, CACHE_TTL.ARTIST_DATA);
    return artist;
  } catch (error) {
    console.error('[OffDaWallV2] MusicBrainz artist fetch error:', error);
    return null;
  }
}

export async function getArtistReleases(mbid: string, limit: number = 50): Promise<Album[]> {
  const cacheKey = `mb:releases:${mbid}:${limit}`;
  const cached = cache.get<Album[]>(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    const data = await fetchMusicBrainz(
      `/release-group?artist=${mbid}&type=album|ep|single&limit=${limit}&fmt=json`
    );

    const albums: Album[] = (data['release-groups'] || []).map((rg: MusicBrainzRelease) => ({
      mbid: rg.id,
      title: rg.title,
      artistMbid: mbid,
      artistName: rg['artist-credit']?.[0]?.name || '',
      releaseDate: rg['first-release-date'],
      type: (rg['primary-type']?.toLowerCase() || 'album') as Album['type'],
      trackCount: rg['track-count'],
    }));

    cache.set(cacheKey, albums, CACHE_TTL.CATALOG);
    return albums;
  } catch (error) {
    console.error('[OffDaWallV2] MusicBrainz releases fetch error:', error);
    return [];
  }
}

export async function getRelatedArtists(mbid: string, limit: number = 10): Promise<Artist[]> {
  const cacheKey = `mb:related:${mbid}:${limit}`;
  const cached = cache.get<Artist[]>(cacheKey);
  
  if (cached) {
    return cached;
  }

  try {
    const data = await fetchMusicBrainz(
      `/artist/${mbid}?inc=artist-rels&fmt=json`
    );

    const relatedArtists: Artist[] = (data.relations || [])
      .filter((rel: any) => rel.type === 'member of band' || rel.type === 'collaboration')
      .slice(0, limit)
      .map((rel: any) => ({
        mbid: rel.artist?.id || '',
        name: rel.artist?.name || '',
        sortName: rel.artist?.['sort-name'],
        genres: [],
        tags: [],
      }))
      .filter((a: Artist) => a.mbid);

    cache.set(cacheKey, relatedArtists, CACHE_TTL.ARTIST_DATA);
    return relatedArtists;
  } catch (error) {
    console.error('[OffDaWallV2] MusicBrainz related artists fetch error:', error);
    return [];
  }
}

