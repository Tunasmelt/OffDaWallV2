export type EnrichmentProvider =
  | 'spotify'
  | 'musicbrainz'
  | 'audiodb'
  | 'lastfm'
  | 'deezer'
  | 'coverart';

export type EnrichmentField =
  | 'image'
  | 'popularity'
  | 'followers'
  | 'genres'
  | 'bio'
  | 'socialLinks'
  | 'identity'
  | 'relations'
  | 'catalogStructure'
  | 'topTracks';

export const FIELD_SOURCE_PRIORITY: Record<EnrichmentField, EnrichmentProvider[]> = {
  // Fast-path user-facing fields: Spotify first.
  image: ['spotify', 'audiodb', 'lastfm', 'deezer', 'coverart', 'musicbrainz'],
  popularity: ['spotify', 'deezer', 'musicbrainz'],
  followers: ['spotify', 'deezer'],
  genres: ['spotify', 'musicbrainz', 'lastfm'],

  // Rich text and socials come from music metadata providers.
  bio: ['audiodb', 'lastfm', 'musicbrainz'],
  socialLinks: ['audiodb', 'lastfm'],

  // Canonical identity should still be MB-first.
  identity: ['musicbrainz', 'spotify', 'audiodb'],
  relations: ['musicbrainz', 'lastfm', 'deezer'],
  catalogStructure: ['musicbrainz', 'deezer', 'spotify', 'coverart'],
  topTracks: ['spotify', 'deezer', 'musicbrainz'],
};

export function getFieldSourcePriority(field: EnrichmentField): EnrichmentProvider[] {
  return FIELD_SOURCE_PRIORITY[field];
}

export function pickFirstAvailableSource(
  field: EnrichmentField,
  available: EnrichmentProvider[]
): EnrichmentProvider | null {
  const order = FIELD_SOURCE_PRIORITY[field];
  for (const source of order) {
    if (available.includes(source)) {
      return source;
    }
  }
  return null;
}

