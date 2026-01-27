// Core data types for OffDaWall

export interface Artist {
  mbid: string; // MusicBrainz ID
  name: string;
  sortName?: string;
  disambiguation?: string;
  type?: string;
  genres: string[];
  tags: string[];
  country?: string;
  area?: string;
  beginDate?: string;
  endDate?: string;
  imageUrl?: string;
  bio?: string;
  popularityScore?: number;
  listeners?: number;
  playCount?: number;
  // Social links from AudioDB
  website?: string;
  twitter?: string;
  facebook?: string;
}

export interface Track {
  id: string;
  title: string;
  artistName: string;
  artistMbid?: string;
  albumTitle?: string;
  albumMbid?: string;
  duration?: number; // in seconds
  releaseDate?: string;
  previewUrl?: string; // 30s preview from Deezer
  popularity?: number;
  listeners?: number;
  playCount?: number;
}

export interface Album {
  mbid: string;
  title: string;
  artistMbid: string;
  artistName: string;
  releaseDate?: string;
  type: 'album' | 'ep' | 'single' | 'compilation';
  trackCount?: number;
  coverArtUrl?: string;
  tracks?: Track[];
}

export interface Genre {
  slug: string;
  name: string;
  description: string;
  tags: string[]; // MusicBrainz tags to query
  artistCount?: number;
  previewArtists?: Artist[];
}

export interface Recommendation {
  category: 'popular' | 'trending' | 'gems' | 'unique' | 'unpopular';
  tracks: Track[];
  reason?: string;
}

export interface ApiResponse<T> {
  data: T;
  cached: boolean;
  timestamp: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// MusicBrainz API response types
export interface MusicBrainzArtist {
  id: string;
  name: string;
  'sort-name'?: string;
  disambiguation?: string;
  type?: string;
  country?: string;
  area?: {
    name: string;
  };
  'life-span'?: {
    begin?: string;
    end?: string;
  };
  tags?: Array<{
    count: number;
    name: string;
  }>;
  relations?: Array<{
    type: string;
    artist?: MusicBrainzArtist;
  }>;
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
  'artist-credit'?: Array<{
    name: string;
    artist: {
      id: string;
      name: string;
    };
  }>;
  'track-count'?: number;
}

// AudioDB API response types
export interface AudioDBArtist {
  idArtist: string;
  strArtist: string;
  strArtistThumb?: string;
  strArtistLogo?: string;
  strArtistBanner?: string;
  strBiographyEN?: string;
  strGenre?: string;
  strWebsite?: string;
  strFacebook?: string;
  strTwitter?: string;
  intMembers?: string;
  intBornYear?: string;
}

// Deezer API response types
export interface DeezerArtist {
  id: number;
  name: string;
  picture?: string;
  picture_medium?: string;
  picture_big?: string;
  nb_fan?: number;
  nb_album?: number;
}

export interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  preview: string;
  release_date?: string;
  artist: {
    id: number;
    name: string;
  };
  album: {
    id: number;
    title: string;
    cover?: string;
    cover_medium?: string;
  };
}
