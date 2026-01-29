'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Disc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Album } from '@/lib/types';
import { AudioPlayer } from './audio-player';
import { FallbackImage } from '@/components/ui/fallback-image';
import { fetchJsonCached } from '@/lib/client/fetch-json';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';

interface AlbumCardProps {
  album: Album & { tracks?: any[] };
  index: number;
}

export function AlbumCard({ album, index }: AlbumCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [tracks, setTracks] = useState(album.tracks || []);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [trackLoadAttempted, setTrackLoadAttempted] = useState(false);

  const releaseYear = album.releaseDate ? new Date(album.releaseDate).getFullYear() : null;
  const hasTracks = tracks && tracks.length > 0;

  const typeColors = {
    album: 'bg-primary text-primary-foreground',
    ep: 'bg-muted text-foreground',
    single: 'bg-secondary text-secondary-foreground',
    compilation: 'bg-accent text-accent-foreground',
  };

  useEffect(() => {
    if (!isExpanded) return;
    if (tracks.length > 0) return;
    if (!album.releaseMbid && !album.releaseGroupMbid) return;
    if (trackLoadAttempted) return;

    const controller = new AbortController();
    setIsLoadingTracks(true);
    setTrackLoadAttempted(true);

    const fetchTracks = async () => {
      const primaryUrl = album.releaseMbid
        ? `/api/releases/${album.releaseMbid}/tracks`
        : `/api/release-groups/${album.releaseGroupMbid}/tracks`;
      const fallbackUrl = album.releaseMbid && album.releaseGroupMbid
        ? `/api/release-groups/${album.releaseGroupMbid}/tracks`
        : null;

      try {
        const primary = await fetchJsonCached<any>(primaryUrl, {
          cacheKey: `tracks:${album.releaseMbid || album.releaseGroupMbid}`,
          ttlMs: 5 * 60_000,
          signal: controller.signal,
        });
        if (Array.isArray(primary?.tracks) && primary.tracks.length > 0) {
          setTracks(primary.tracks);
          return;
        }

        if (fallbackUrl) {
          const fallback = await fetchJsonCached<any>(fallbackUrl, {
            cacheKey: `tracks:${album.releaseGroupMbid}`,
            ttlMs: 5 * 60_000,
            signal: controller.signal,
          });
          if (Array.isArray(fallback?.tracks)) {
            setTracks(fallback.tracks);
          }
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          return;
        }
        // Ignore fetch errors; UI will show empty state.
      } finally {
        setIsLoadingTracks(false);
      }
    };

    fetchTracks();

    return () => controller.abort();
  }, [isExpanded, tracks.length, album.releaseMbid, album.releaseGroupMbid, trackLoadAttempted]);

  const disableOptimization =
    album.coverArtUrl?.includes('coverartarchive.org') ||
    album.coverArtUrl?.includes('archive.org');

  return (
    <div
      className="bg-card border border-border overflow-hidden transition-all duration-300"
      style={{
        transform: `rotate(${(index % 3 - 1) * 0.5}deg)`,
      }}
    >
      <div className="p-4">
        {/* Album Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="relative w-20 h-20 bg-muted flex-shrink-0 border-2 border-border">
            {album.coverArtUrl && !imageError ? (
              <FallbackImage
                src={album.coverArtUrl || "/placeholder.svg"}
                alt={album.title}
                fill
                className="object-cover grayscale"
                sizes="80px"
                fallbackSrc="/placeholder.svg"
                onError={() => setImageError(true)}
                unoptimized={disableOptimization}
              />
            ) : (
              <ImagePlaceholder
                label={album.title}
                textClassName="text-2xl"
                className="border-none"
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2">
              {album.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {releaseYear && <span>{releaseYear}</span>}
              {releaseYear && <span>•</span>}
              <Badge variant="outline" className={typeColors[album.type]}>
                {album.type.toUpperCase()}
              </Badge>
              {album.trackCount && (
                <>
                  <span>•</span>
                  <span>{album.trackCount} tracks</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Expand Button */}
        {(hasTracks || album.releaseMbid || album.releaseGroupMbid) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Hide Tracks
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                {album.trackCount || tracks.length
                  ? `Show ${album.trackCount || tracks.length} Tracks`
                  : 'Show Tracks'}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Track List */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/20 p-4 space-y-3">
          {isLoadingTracks && (
            <div className="text-sm text-muted-foreground text-center py-4">
              Loading tracks...
            </div>
          )}

          {tracks.map((track, idx) => (
            <div key={track.id} className="space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-xs text-muted-foreground font-mono w-6 text-right flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{track.title}</div>
                  {track.duration && (
                    <div className="text-xs text-muted-foreground">
                      {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                    </div>
                  )}
                </div>
                {track.previewUrl ? (
                  <Button
                    size="sm"
                    variant={currentTrackIndex === idx ? 'default' : 'outline'}
                    onClick={() => setCurrentTrackIndex(currentTrackIndex === idx ? null : idx)}
                    className="flex-shrink-0"
                  >
                    {currentTrackIndex === idx ? 'Hide' : 'Preview'}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">No preview</span>
                )}
              </div>

              {/* Audio Player */}
              {currentTrackIndex === idx && track.previewUrl && (
                <AudioPlayer
                  previewUrl={track.previewUrl}
                  trackTitle={track.title}
                  artistName={track.artistName}
                  onEnded={() => setCurrentTrackIndex(null)}
                />
              )}
            </div>
          ))}

          {!isLoadingTracks && tracks.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No tracks available for this release
            </div>
          )}
        </div>
      )}
    </div>
  );
}
