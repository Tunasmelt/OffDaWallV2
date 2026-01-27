import { NextResponse } from 'next/server';
import { getGenreBySlug } from '@/lib/genres';
import { getArtistsForGenre } from '@/lib/services/aggregator';
import type { Artist } from '@/lib/types';

// Calculate popularity score based on available data
function calculatePopularityScore(artist: Artist): number {
  let score = 0;
  
  // Listener count is the primary factor (normalized to 0-100)
  if (artist.listeners) {
    score += Math.min(artist.listeners / 100000, 100) * 0.7;
  }
  
  // Tags/genres indicate recognition
  if (artist.tags && artist.tags.length > 0) {
    score += Math.min(artist.tags.length * 2, 20);
  }
  
  // Having complete data (bio, images) indicates established artist
  if (artist.bio) score += 5;
  if (artist.imageUrl) score += 5;
  
  return score;
}

// Categorize artists into top and upcoming
function categorizeArtists(artists: Artist[]) {
  // Calculate popularity scores
  const artistsWithScores = artists.map(artist => ({
    ...artist,
    popularityScore: calculatePopularityScore(artist),
  }));
  
  // Sort by popularity
  artistsWithScores.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
  
  // Calculate percentile thresholds
  const scores = artistsWithScores.map(a => a.popularityScore || 0);
  const p80 = scores[Math.floor(scores.length * 0.2)] || 50; // Top 20%
  const p50 = scores[Math.floor(scores.length * 0.5)] || 25; // 50th percentile
  
  const topArtists = artistsWithScores.filter(a => (a.popularityScore || 0) >= p80);
  const upcomingArtists = artistsWithScores.filter(a => {
    const score = a.popularityScore || 0;
    return score >= p50 && score < p80;
  });
  
  return {
    topArtists: topArtists.slice(0, 20),
    upcomingArtists: upcomingArtists.slice(0, 20),
    totalCount: artistsWithScores.length,
  };
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    
    // Get genre info
    const genre = getGenreBySlug(slug);
    
    if (!genre) {
      return NextResponse.json(
        { error: 'Genre not found' },
        { status: 404 }
      );
    }
    
    // Fetch artists for this genre
    const artists = await getArtistsForGenre(genre.tags, 50);
    
    if (artists.length === 0) {
      return NextResponse.json({
        genre,
        topArtists: [],
        upcomingArtists: [],
        totalCount: 0,
        message: 'No artists found for this genre',
      });
    }
    
    // Categorize artists
    const { topArtists, upcomingArtists, totalCount } = categorizeArtists(artists);
    
    return NextResponse.json({
      genre,
      topArtists,
      upcomingArtists,
      totalCount,
      cached: false,
      timestamp: Date.now(),
    });
    
  } catch (error) {
    console.error('[OffDaWallV2] Genre API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch genre data' },
      { status: 500 }
    );
  }
}

