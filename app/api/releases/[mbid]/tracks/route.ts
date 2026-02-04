import * as MusicBrainz from '@/lib/services/musicbrainz';
import * as Deezer from '@/lib/services/deezer';
import * as LastFm from '@/lib/services/lastfm';
import type { Track } from '@/lib/types';
import { respondOk, respondError } from '@/lib/api-response';
import { logEvent } from '@/lib/observability';
import { safeCall } from '@/lib/provider-safe';

function extractTracks(releaseData: any): Track[] {
  const media = releaseData?.media || [];
  const tracks: Track[] = [];

  media.forEach((medium: any) => {
    (medium.tracks || []).forEach((track: any) => {
      tracks.push({
        id: track.id || `mb-track:${track.position}`,
        title: track.title || track.recording?.title || '',
        artistName: track.artist?.name || releaseData?.['artist-credit']?.[0]?.name || '',
        duration: track.length ? Math.round(track.length / 1000) : undefined,
        trackNumber: track.position,
      });
    });
  });

  return tracks;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mbid: string }> }
) {
  try {
    const { mbid } = await params;

    const releaseResult = await safeCall('musicbrainz', () => MusicBrainz.getReleaseWithRecordings(mbid));
    const release = releaseResult.ok ? releaseResult.data : null;
    let tracks = release ? extractTracks(release) : [];
    const providersUsed: string[] = [];
    if (releaseResult.ok) {
      providersUsed.push('musicbrainz');
    }

    // If MusicBrainz has no tracklist, try Last.fm by MBID
    if (tracks.length === 0 && process.env.LASTFM_API_KEY) {
      const lfResult = await safeCall('lastfm', () => LastFm.getAlbumInfoByMbid(mbid));
      const lfInfo = lfResult.ok ? lfResult.data : null;
      tracks = LastFm.extractTracksFromAlbumInfo(lfInfo);
      if (lfResult.ok) {
        providersUsed.push('lastfm');
      }
    }

    // Attach preview URLs via Deezer top tracks (best-effort)
    const artistName = release?.['artist-credit']?.[0]?.name;
    if (artistName) {
      const deezerArtistResult = await safeCall('deezer', () => Deezer.searchArtist(artistName));
      const deezerArtist = deezerArtistResult.ok ? deezerArtistResult.data : null;
      if (deezerArtistResult.ok) {
        providersUsed.push('deezer');
      }
      if (deezerArtist) {
        const deezerTracksResult = await safeCall('deezer', () => Deezer.getArtistTopTracks(deezerArtist.id, 100));
        const deezerTracks = deezerTracksResult.ok ? deezerTracksResult.data : [];
        if (deezerTracksResult.ok && !providersUsed.includes('deezer')) {
          providersUsed.push('deezer');
        }
        tracks = tracks.map((t) => {
          const match = deezerTracks.find(dt =>
            dt.title.toLowerCase().includes(t.title.toLowerCase()) ||
            t.title.toLowerCase().includes(dt.title.toLowerCase())
          );
          return {
            ...t,
            previewUrl: match?.previewUrl,
            playCount: match?.playCount,
          };
        });
      }
    }

    // If previews are still missing, try targeted Deezer searches (limited)
    const missing = tracks.filter(t => !t.previewUrl).slice(0, 8);
    if (missing.length > 0) {
      const filled = await Promise.all(
        missing.map(async (t) => {
          const matchResult = await safeCall('deezer', () => Deezer.searchTrack(artistName || t.artistName, t.title));
          const match = matchResult.ok ? matchResult.data : null;
          if (matchResult.ok && !providersUsed.includes('deezer')) {
            providersUsed.push('deezer');
          }
          return {
            id: t.id,
            previewUrl: match?.previewUrl,
            playCount: match?.playCount,
            duration: match?.duration,
          };
        })
      );

      const byId = new Map(filled.map(f => [f.id, f]));
      tracks = tracks.map((t) => {
        const patch = byId.get(t.id);
        return patch
          ? {
              ...t,
              previewUrl: patch.previewUrl || t.previewUrl,
              playCount: patch.playCount || t.playCount,
              duration: patch.duration || t.duration,
            }
          : t;
      });
    }

    logEvent('info', '[OffDaWallV2] api/releases/[mbid]/tracks', { success: true, mbid });
    const resp = respondOk(
      { tracks },
      { payloadMode: 'preview', providersUsed, cache: { hit: false } }
    );
    resp.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return resp;
  } catch (error) {
    logEvent('error', '[OffDaWallV2] api/releases/[mbid]/tracks', { success: false, error: `${error}` });
    return respondError(
      'tracks_failed',
      'Failed to fetch tracks',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}
