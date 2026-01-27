import { NextRequest, NextResponse } from 'next/server';
import * as MusicBrainz from '@/lib/services/musicbrainz';
import * as Deezer from '@/lib/services/deezer';
import { generateRecommendations } from '@/lib/recommendation-engine';
import type { Album } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { mbid: string } }
) {
  try {
    const mbid = params.mbid;
    console.log('[OffDaWallV2] Fetching recommendations for artist:', mbid);

    // Get artist's catalog from MusicBrainz
    const releases = await MusicBrainz.getArtistReleases(mbid);
    console.log('[OffDaWallV2] Found', releases.length, 'releases');

    if (releases.length === 0) {
      return NextResponse.json({
        popular: [],
        trending: [],
        gems: [],
        unique: [],
        unpopular: [],
      });
    }

    // Get artist name for Deezer lookup
    const artist = await MusicBrainz.getArtistById(mbid);
    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Enhance with Deezer track data (for popularity metrics)
    const deezerArtist = await Deezer.searchArtist(artist.name);
    let enhancedReleases: Album[] = releases;

    if (deezerArtist) {
      console.log('[OffDaWallV2] Found Deezer artist, fetching tracks');
      const deezerTracks = await Deezer.getTopTracks(deezerArtist.id);
      
      // Merge Deezer data with MusicBrainz releases
      enhancedReleases = releases.map(album => ({
        ...album,
        tracks: album.tracks?.map(track => {
          // Try to match with Deezer track for play count
          const deezerMatch = deezerTracks.find(dt => 
            dt.title.toLowerCase().includes(track.title.toLowerCase()) ||
            track.title.toLowerCase().includes(dt.title.toLowerCase())
          );

          return {
            ...track,
            playCount: deezerMatch?.rank || undefined,
            previewUrl: deezerMatch?.preview || track.previewUrl,
          };
        }),
      }));
    }

    // Generate recommendations using the engine
    const recommendations = generateRecommendations(enhancedReleases);

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('[OffDaWallV2] Recommendations API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

