import { NextResponse } from 'next/server';
import * as MusicBrainz from '@/lib/services/musicbrainz';
import * as Deezer from '@/lib/services/deezer';

export async function GET(
  request: Request,
  { params }: { params: { mbid: string } }
) {
  try {
    const { mbid } = params;
    
    // Get albums from MusicBrainz
    const albums = await MusicBrainz.getArtistReleases(mbid, 100);
    
    // Get artist name for Deezer search
    const artist = await MusicBrainz.getArtistById(mbid);
    
    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }
    
    // Try to get tracks from Deezer for preview URLs
    let tracks = [];
    try {
      const deezerArtist = await Deezer.searchArtist(artist.name);
      if (deezerArtist) {
        tracks = await Deezer.getArtistTopTracks(deezerArtist.id, 100);
      }
    } catch (error) {
      console.error('[OffDaWallV2] Deezer track fetch failed:', error);
    }

    return NextResponse.json({
      albums: albums.map(album => ({
        ...album,
        // Try to find matching tracks
        tracks: tracks.filter(t => 
          t.albumTitle?.toLowerCase().includes(album.title.toLowerCase()) ||
          album.title.toLowerCase().includes(t.albumTitle?.toLowerCase() || '')
        ).slice(0, 20),
      })),
      allTracks: tracks,
    });
  } catch (error) {
    console.error('[OffDaWallV2] Catalog API error:', error);
    return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 });
  }
}

