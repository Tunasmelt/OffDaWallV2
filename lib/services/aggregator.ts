import type { Artist } from '../types';
import { normalizeImageUrl } from '../images';
import * as MusicBrainz from './musicbrainz';
import * as AudioDB from './audiodb';
import * as Deezer from './deezer';
import * as LastFm from './lastfm';
import * as Spotify from './spotify';
import { getArtistCoverArtFallback } from './image-resolver';

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
    let deezerData: { listeners?: number; imageUrl?: string; popularity?: number } | null = null;
    try {
      const deezerArtist = await Deezer.searchArtist(mbArtist.name);
      if (deezerArtist) {
        deezerData = {
          listeners: deezerArtist.nb_fan || undefined,
          imageUrl: audioDBData?.imageUrl || deezerArtist.picture_big,
        };
      }
    } catch (error) {
      console.error('[OffDaWallV2] Deezer enhancement failed:', error);
    }

    // Spotify enrichment (genres, popularity, followers, image fallback)
    let spotifyData: Partial<Artist> | null = null;
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      try {
        const spotifyArtist = await Spotify.searchArtistByName(mbArtist.name);
        if (spotifyArtist) {
          spotifyData = {
            popularity: typeof spotifyArtist.popularity === 'number' ? spotifyArtist.popularity / 100 : undefined,
            followers: spotifyArtist.followers?.total,
            genres: (spotifyArtist.genres || []).slice(0, 5),
            imageUrl: Spotify.extractArtistImage(spotifyArtist),
          };
        }
      } catch (error) {
        console.error('[OffDaWallV2] Spotify enhancement failed:', error);
      }
    }

    // Merge all data
    let resolvedImage = normalizeImageUrl(
      audioDBData?.imageUrl ||
      spotifyData?.imageUrl ||
      deezerData?.imageUrl ||
      mbArtist.image
    );
    if (!resolvedImage) {
      resolvedImage = normalizeImageUrl(await getArtistCoverArtFallback(mbid));
    }
    const completeArtist: Artist = {
      ...mbArtist,
      ...audioDBData,
      ...deezerData,
      ...spotifyData,
      imageUrl: resolvedImage,
      image: resolvedImage || mbArtist.image,
      listeners: deezerData?.listeners ?? spotifyData?.followers,
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

    // Last.fm fallback for image/bio
    let lastFmData: Partial<Artist> | null = null;
    if (process.env.LASTFM_API_KEY) {
      const lfInfoByMbid = await LastFm.getArtistInfoByMbid(mbid);
      const lfInfo = lfInfoByMbid || (mbArtist?.name ? await LastFm.getArtistInfoByName(mbArtist.name) : null);
      if (lfInfo) {
        lastFmData = {
          imageUrl: LastFm.extractArtistImage(lfInfo),
          bio: LastFm.extractArtistBio(lfInfo),
        };
      }
    }

    // Get Deezer stats for popularity
    let deezerData: { listeners?: number; popularity?: number; imageUrl?: string } | null = null;
    try {
      const deezerArtist = await Deezer.searchArtist(mbArtist.name);
      if (deezerArtist) {
        deezerData = {
          listeners: deezerArtist.nb_fan || undefined,
          popularity: deezerArtist.nb_fan ? Math.min(deezerArtist.nb_fan / 1000000, 1) : undefined, // Normalize to 0-1
        };
        console.log('[OffDaWallV2] Deezer data found, fans:', deezerArtist.nb_fan);
      }
    } catch (error) {
      console.error('[OffDaWallV2] Deezer enhancement failed:', error);
    }

    // Spotify enrichment (genres, popularity, followers, image fallback)
    let spotifyData: Partial<Artist> | null = null;
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      try {
        const spotifyArtist = await Spotify.searchArtistByName(mbArtist.name);
        if (spotifyArtist) {
          spotifyData = {
            popularity: typeof spotifyArtist.popularity === 'number' ? spotifyArtist.popularity / 100 : undefined,
            followers: spotifyArtist.followers?.total,
            genres: (spotifyArtist.genres || []).slice(0, 5),
            imageUrl: Spotify.extractArtistImage(spotifyArtist),
          };
        }
      } catch (error) {
        console.error('[OffDaWallV2] Spotify enhancement failed:', error);
      }
    }

    // Merge all data
    let resolvedImage = normalizeImageUrl(
      audioDBData?.imageUrl ||
      spotifyData?.imageUrl ||
      lastFmData?.imageUrl ||
      deezerData?.imageUrl ||
      mbArtist.image
    );
    if (!resolvedImage) {
      resolvedImage = normalizeImageUrl(await getArtistCoverArtFallback(mbid));
    }
    const completeArtist: Artist = {
      ...mbArtist,
      imageUrl: resolvedImage,
      image: resolvedImage || mbArtist.image,
      bio: audioDBData?.bio || lastFmData?.bio || mbArtist.bio,
      website: audioDBData?.website || mbArtist.website,
      facebook: audioDBData?.facebook || mbArtist.facebook,
      twitter: audioDBData?.twitter || mbArtist.twitter,
      relatedArtists: relatedArtists,
      ...deezerData,
      ...spotifyData,
      listeners: deezerData?.listeners ?? spotifyData?.followers,
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

    // Avoid AudioDB here to prevent rate-limit noise in dev; enrich at route level instead.
    return mbArtists;
  } catch (error) {
    console.error('[OffDaWallV2] Genre artists aggregation error:', error);
    return [];
  }
}

