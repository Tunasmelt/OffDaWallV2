import type { Track, Album } from './types';

/**
 * Recommendation Engine for OffDaWall
 * Content-based filtering using track metadata and popularity scores
 */

export interface ScoredTrack extends Track {
  popularityScore: number;
  recencyScore: number;
  uniquenessScore: number;
  overallScore: number;
}

export interface Recommendations {
  popular: ScoredTrack[];
  trending: ScoredTrack[];
  gems: ScoredTrack[];
  unique: ScoredTrack[];
  unpopular: ScoredTrack[];
}

/**
 * Calculate how recent a release is (0-1 scale)
 */
function calculateRecencyScore(releaseDate?: string): number {
  if (!releaseDate) return 0;

  try {
    const releaseYear = parseInt(releaseDate.split('-')[0]);
    const currentYear = new Date().getFullYear();
    const yearsDiff = currentYear - releaseYear;

    // Recent (0-2 years) = high score
    // Mid (3-5 years) = medium score
    // Old (6+ years) = low score
    if (yearsDiff <= 2) return 1.0;
    if (yearsDiff <= 5) return 0.7;
    if (yearsDiff <= 10) return 0.4;
    return 0.1;
  } catch {
    return 0;
  }
}

/**
 * Calculate popularity score based on various metrics
 */
function calculatePopularityScore(track: Track, maxPlayCount: number): number {
  if (!track.playCount || maxPlayCount === 0) return 0.5; // Default for unknown

  return Math.min(track.playCount / maxPlayCount, 1);
}

/**
 * Calculate uniqueness score (inverse of popularity + other factors)
 */
function calculateUniquenessScore(track: Track, popularityScore: number): number {
  // Base uniqueness is inverse of popularity
  let uniqueness = 1 - popularityScore;

  // Bonus for being a deep album track (not single)
  if (track.trackNumber && track.trackNumber > 3) {
    uniqueness += 0.2;
  }

  // Bonus for longer tracks (potentially experimental)
  if (track.duration && track.duration > 300) {
    uniqueness += 0.1;
  }

  return Math.min(uniqueness, 1);
}

/**
 * Score all tracks in a catalog
 */
function scoreTracks(albums: Album[]): ScoredTrack[] {
  const allTracks: Track[] = [];

  // Flatten all tracks from all albums
  albums.forEach(album => {
    if (album.tracks) {
      album.tracks.forEach(track => {
        allTracks.push({
          ...track,
          releaseDate: track.releaseDate || album.releaseDate,
        });
      });
    }
  });

  if (allTracks.length === 0) return [];

  // Find max play count for normalization
  const maxPlayCount = Math.max(...allTracks.map(t => t.playCount || 0), 1);

  // Score each track
  const scoredTracks: ScoredTrack[] = allTracks.map(track => {
    const popularityScore = calculatePopularityScore(track, maxPlayCount);
    const recencyScore = calculateRecencyScore(track.releaseDate);
    const uniquenessScore = calculateUniquenessScore(track, popularityScore);

    // Overall score is weighted average
    const overallScore = 
      (popularityScore * 0.4) + 
      (recencyScore * 0.3) + 
      (uniquenessScore * 0.3);

    return {
      ...track,
      popularityScore,
      recencyScore,
      uniquenessScore,
      overallScore,
    };
  });

  return scoredTracks;
}

/**
 * Generate recommendations across 5 categories
 */
export function generateRecommendations(albums: Album[]): Recommendations {
  console.log('[OffDaWallV2] Generating recommendations for', albums.length, 'albums');

  const scoredTracks = scoreTracks(albums);

  if (scoredTracks.length === 0) {
    return {
      popular: [],
      trending: [],
      gems: [],
      unique: [],
      unpopular: [],
    };
  }

  console.log('[OffDaWallV2] Scored', scoredTracks.length, 'tracks');

  // Sort and filter into categories
  const recommendations: Recommendations = {
    // Popular: High popularity score
    popular: scoredTracks
      .filter(t => t.popularityScore > 0.6)
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 12),

    // Trending: High recency + decent popularity
    trending: scoredTracks
      .filter(t => t.recencyScore > 0.6 && t.popularityScore > 0.3)
      .sort((a, b) => b.recencyScore - a.recencyScore)
      .slice(0, 12),

    // Gems: Medium popularity (hidden gems that deserve more attention)
    gems: scoredTracks
      .filter(t => t.popularityScore > 0.3 && t.popularityScore < 0.7)
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 12),

    // Unique: High uniqueness score (deep cuts, experimental)
    unique: scoredTracks
      .filter(t => t.uniquenessScore > 0.6)
      .sort((a, b) => b.uniquenessScore - a.uniquenessScore)
      .slice(0, 12),

    // Unpopular: Low popularity (for true fans exploring everything)
    unpopular: scoredTracks
      .filter(t => t.popularityScore < 0.3)
      .sort((a, b) => a.popularityScore - b.popularityScore)
      .slice(0, 12),
  };

  console.log('[OffDaWallV2] Recommendations generated:', {
    popular: recommendations.popular.length,
    trending: recommendations.trending.length,
    gems: recommendations.gems.length,
    unique: recommendations.unique.length,
    unpopular: recommendations.unpopular.length,
  });

  return recommendations;
}

/**
 * Get explanation for why a track was recommended
 */
export function getRecommendationReason(track: ScoredTrack, category: keyof Recommendations): string {
  switch (category) {
    case 'popular':
      return `Top ${Math.round(track.popularityScore * 100)}% most played track`;
    case 'trending':
      return `Recent release with ${Math.round(track.popularityScore * 100)}% popularity`;
    case 'gems':
      return `Solid ${Math.round(track.overallScore * 100)}% overall score, deserves more attention`;
    case 'unique':
      return `${Math.round(track.uniquenessScore * 100)}% uniqueness - a deep cut for real fans`;
    case 'unpopular':
      return `Rarely played - discover something OffDaWall`;
    default:
      return 'Recommended based on artist catalog analysis';
  }
}

