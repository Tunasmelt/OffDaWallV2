import { NextRequest, NextResponse } from 'next/server';
import { getArtistProfile } from '@/lib/services/aggregator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  try {
    const { mbid } = await params;

    if (!mbid) {
      return NextResponse.json(
        { error: 'Artist MBID is required' },
        { status: 400 }
      );
    }

    console.log('[OffDaWallV2] Fetching artist profile for MBID:', mbid);

    const artist = await getArtistProfile(mbid);

    if (!artist) {
      console.log('[OffDaWallV2] Artist not found:', mbid);
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    console.log('[OffDaWallV2] Successfully fetched artist:', artist.name);

    return NextResponse.json(artist, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
      },
    });
  } catch (error) {
    console.error('[OffDaWallV2] Error fetching artist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artist profile' },
      { status: 500 }
    );
  }
}

