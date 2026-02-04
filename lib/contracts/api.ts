export type ApiMeta = {
  requestId: string;
  durationMs: number;
  providerMs?: Record<string, number>;
  cached?: boolean;
  fastPath?: boolean;
  source?: string;
  fallbackUsed?: string[];
  emptyReason?: string;
  status?: 'ok' | 'partial' | 'empty' | 'rate_limited';
  payloadMode?: 'preview' | 'deep';
  providersUsed?: string[];
  cache?: { hit: boolean; stale?: boolean };
};

export type ApiOk<T> = { ok: true; data: T; meta: ApiMeta };
export type ApiErr = {
  ok: false;
  error: { code: string; message: string; detail?: any };
  meta: ApiMeta;
};

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export type ArtistPreviewDTO = {
  mbid: string;
  name: string;
  area?: string;
  tags?: string[];
  imageUrl?: string | null;
  image?: string | null;
};

export type GenrePreviewDTO = {
  slug: string;
  name: string;
  description: string;
  previewArtists?: ArtistPreviewDTO[];
  previewImageUrl?: string | null;
};

export type AlbumDTO = {
  mbid: string;
  title: string;
  artistMbid: string;
  artistName: string;
  releaseDate?: string;
  type: 'album' | 'ep' | 'single' | 'compilation';
  trackCount?: number;
  coverArtUrl?: string | null;
  releaseMbid?: string;
  releaseGroupMbid?: string;
  tracks?: any[];
};

export type ArtistProfileDTO = {
  mbid: string;
  name: string;
  area?: string;
  tags?: string[];
  bio?: string;
  imageUrl?: string | null;
  image?: string | null;
  relatedArtists?: ArtistPreviewDTO[];
  lifespan?: { begin?: string; end?: string; ended?: boolean };
};

export type ArtistCatalogDTO = {
  artistMbid?: string;
  mode: 'preview' | 'deep-dive';
  albums: AlbumDTO[];
  allTracks?: any[];
  partial?: boolean;
  message?: string;
  fallbackUsed?: string[];
  emptyReason?: string;
};

export type ArtistRecommendationsDTO = {
  artistMbid: string;
  categories: Record<string, any[]>;
  message?: string;
};

export type GenresPreviewDTO = {
  genres: GenrePreviewDTO[];
};

export type SearchDTO = {
  q: string;
  artists: ArtistPreviewDTO[];
  genres: GenrePreviewDTO[];
};
