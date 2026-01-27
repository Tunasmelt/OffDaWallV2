import type { Artist } from '../types';
import * as MusicBrainz from './musicbrainz';
import * as AudioDB from './audiodb';
import * as Deezer from './deezer';

/**
 * Aggregate artist data from multiple sources
 * Priority: MusicBrainz (metadata) → AudioDB (images/bio) → Deezer (stats)
 */
export async function getCompleteArtist(mbid: string): Promise<Artist | null> {
  try {
    // Get base data from MusicBrainz
    const mbArtist = await MusicBrainz.getArtistById(mbid);
    
    if (!mbArtist) {
      return null;
    }

    // Enhance with AudioDB data (images and bio)
    const audioDBData = await AudioDB.getArtistByMBID(mbid);

    // Get Deezer stats
    let deezerData = null;
    try {
      const deezerArtist = await Deezer.searchArtist(mbArtist.name);
      if (deezerArtist) {
        deezerData = {
          listeners: deezerArtist.nb_fan,
          imageUrl: audioDBData?.imageUrl || deezerArtist.picture_big,
        };
      }
    } catch (error) {
      console.error('[OffDaWallV2] Deezer enhancement failed:', error);
    }

    // Merge all data
    const completeArtist: Artist = {
      ...mbArtist,
      ...audioDBData,
      ...deezerData,
    };

    return completeArtist;
  } catch (error) {
    console.error('[OffDaWallV2] Artist aggregation error:', error);
    return null;
  }
}

/**
 * Get complete artist profile with full metadata, bio, images, and related artists
 */
export async function getArtistProfile(mbid: string): Promise<Artist | null> {
  try {
    console.log('[OffDaWallV2] Fetching artist profile for:', mbid);

    // Get base data from MusicBrainz with related artists
    const mbArtist = await MusicBrainz.getArtistById(mbid);
    
    if (!mbArtist) {
      console.log('[OffDaWallV2] Artist not found in MusicBrainz:', mbid);
      return null;
    }

    console.log('[OffDaWallV2] MusicBrainz data fetched for:', mbArtist.name);

    // Get related artists from MusicBrainz
    const relatedArtists = await MusicBrainz.getRelatedArtists(mbid);
    console.log('[OffDaWallV2] Related artists found:', relatedArtists.length);

    // Enhance with AudioDB data (images and bio)
    const audioDBData = await AudioDB.getArtistByMBID(mbid);
    console.log('[OffDaWallV2] AudioDB data:', audioDBData ? 'found' : 'not found');

    // Get Deezer stats for popularity
    let deezerData = null;
    try {
      const deezerArtist = await Deezer.searchArtist(mbArtist.name);
      if (deezerArtist) {
        deezerData = {
          listeners: deezerArtist.nb_fan,
          popularity: Math.min(deezerArtist.nb_fan / 1000000, 1), // Normalize to 0-1
        };
        console.log('[OffDaWallV2] Deezer data found, fans:', deezerArtist.nb_fan);
      }
    } catch (error) {
      console.error('[OffDaWallV2] Deezer enhancement failed:', error);
    }

    // Merge all data
    const completeArtist: Artist = {
      ...mbArtist,
      image: audioDBData?.imageUrl || mbArtist.image,
      bio: audioDBData?.bio || mbArtist.bio,
      socialLinks: audioDBData?.socialLinks || mbArtist.socialLinks,
      relatedArtists: relatedArtists,
      ...deezerData,
    };

    console.log('[OffDaWallV2] Complete artist profile assembled for:', completeArtist.name);

    return completeArtist;
  } catch (error) {
    console.error('[OffDaWallV2] Artist profile aggregation error:', error);
    return null;
  }
}

/**
 * Get artists for a genre with complete data
 */
export async function getArtistsForGenre(tags: string[], limit: number = 20): Promise<Artist[]> {
  try {
    // Get artists from MusicBrainz
    const mbArtists = await MusicBrainz.searchArtistsByTags(tags, limit);

    // Enhance with additional data (do this selectively to avoid rate limits)
    const enhancedArtists = await Promise.all(
      mbArtists.slice(0, 10).map(async (artist) => {
        const audioDBData = await AudioDB.getArtistByMBID(artist.mbid);
        return {
          ...artist,
          ...audioDBData,
        };
      })
    );

    // Return enhanced artists first, then remaining basic artists
    return [
      ...enhancedArtists,
      ...mbArtists.slice(10),
    ];
  } catch (error) {
    console.error('[OffDaWallV2] Genre artists aggregation error:', error);
    return [];
  }
}

