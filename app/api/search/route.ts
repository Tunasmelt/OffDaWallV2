import { NextRequest, NextResponse } from 'next/server';
import * as MusicBrainz from '@/lib/services/musicbrainz';
import * as AudioDB from '@/lib/services/audiodb';
import { getFromCache, setCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const genre = searchParams.get('genre');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ 
        error: 'Query must be at least 2 characters' 
      }, { status: 400 });
    }

    console.log('[OffDaWallV2] Search query:', query, 'Genre filter:', genre || 'none');

    const cacheKey = `search:${query}:${genre || 'all'}`;
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      console.log('[OffDaWallV2] Returning cached search results');
      return NextResponse.json(cached);
    }

    // Search MusicBrainz
    const searchResults = await MusicBrainz.searchArtists(query, genre ? [genre] : undefined);
    console.log('[OffDaWallV2] Found', searchResults.length, 'artists');

    // Enhance top 5 results with images from AudioDB
    const enhancedResults = await Promise.all(
      searchResults.slice(0, 5).map(async (artist) => {
        const audioDBData = await AudioDB.getArtistByMBID(artist.mbid);
        return {
          ...artist,
          image: audioDBData?.imageUrl || artist.image,
        };
      })
    );

    const allResults = [
      ...enhancedResults,
      ...searchResults.slice(5),
    ];

    const response = {
      query,
      genre: genre || null,
      results: allResults,
      total: allResults.length,
    };

    // Cache for 1 hour
    setCache(cacheKey, response, 3600);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[OffDaWallV2] Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

