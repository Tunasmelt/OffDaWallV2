import { normalizeImageUrl } from '../images';
import { fetchJson } from './http';

const COVER_ART = 'https://coverartarchive.org';

export async function getCoverArtUrl(releaseMbid: string): Promise<string | null> {
  try {
    const data = await fetchJson(`${COVER_ART}/release/${releaseMbid}`, {}, {
      timeoutMs: 4500,
      retries: 1,
      headers: {
        Accept: 'application/json',
      },
    });
    const images = data?.images || [];
    const front = images.find((img: any) => img.front) || images[0];
    return normalizeImageUrl(front?.thumbnails?.['250'] || front?.image) || null;
  } catch {
    return null;
  }
}

export async function getCoverArtUrlForReleaseGroup(releaseGroupMbid: string): Promise<string | null> {
  try {
    const data = await fetchJson(`${COVER_ART}/release-group/${releaseGroupMbid}`, {}, {
      timeoutMs: 4500,
      retries: 1,
      headers: {
        Accept: 'application/json',
      },
    });
    const images = data?.images || [];
    const front = images.find((img: any) => img.front) || images[0];
    return normalizeImageUrl(front?.thumbnails?.['250'] || front?.image) || null;
  } catch {
    return null;
  }
}
