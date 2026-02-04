export type ProviderName =
  | 'musicbrainz'
  | 'audiodb'
  | 'lastfm'
  | 'deezer'
  | 'spotify'
  | 'coverart'
  | 'archiveorg';

export type ProviderLimit = {
  minIntervalMs: number;
  concurrency: number;
};

export const PROVIDER_LIMITS: Record<ProviderName, ProviderLimit> = {
  musicbrainz: { minIntervalMs: 1000, concurrency: 1 },
  audiodb: { minIntervalMs: 1000, concurrency: 1 },
  lastfm: { minIntervalMs: 500, concurrency: 2 },
  deezer: { minIntervalMs: 125, concurrency: 4 },
  spotify: { minIntervalMs: 150, concurrency: 3 },
  coverart: { minIntervalMs: 500, concurrency: 2 },
  archiveorg: { minIntervalMs: 1000, concurrency: 1 },
};

export const GLOBAL_LIMITS = {
  concurrency: 8,
};
