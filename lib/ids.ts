// MusicBrainz IDs are UUIDs, but not guaranteed to be v4 specifically.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_ARTIST_TYPES = new Set([
  'person',
  'group',
  'orchestra',
  'choir',
  'character',
  'other',
]);

export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

export function isLikelyArtistType(type?: string | null): boolean {
  if (!type) return true;
  const normalized = type.toLowerCase();
  if (ALLOWED_ARTIST_TYPES.has(normalized)) return true;
  return false;
}
