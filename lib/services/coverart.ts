import { normalizeImageUrl } from '../images';
import { providerFetchJson } from '../providers/provider-fetch';

const COVER_ART = 'https://coverartarchive.org';
type CoverArtPayload = {
  images?: Array<{
    front?: boolean;
    image?: string;
    thumbnails?: {
      '250'?: string;
    };
  }>;
};

export async function getCoverArtUrl(releaseMbid: string): Promise<string | null> {
  try {
    const { data } = await providerFetchJson<CoverArtPayload>('coverart', `${COVER_ART}/release/${releaseMbid}`, {
      timeoutMs: 4500,
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
    const { data } = await providerFetchJson<CoverArtPayload>('coverart', `${COVER_ART}/release-group/${releaseGroupMbid}`, {
      timeoutMs: 4500,
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
