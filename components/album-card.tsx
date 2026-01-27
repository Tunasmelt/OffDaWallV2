'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronUp, Disc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Album } from '@/lib/types';
import { AudioPlayer } from './audio-player';

interface AlbumCardProps {
  album: Album & { tracks?: any[] };
  index: number;
}

export function AlbumCard({ album, index }: AlbumCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);

  const releaseYear = album.releaseDate ? new Date(album.releaseDate).getFullYear() : null;
  const hasTracks = album.tracks && album.tracks.length > 0;

  const typeColors = {
    album: 'bg-primary text-primary-foreground',
    ep: 'bg-muted text-foreground',
    single: 'bg-secondary text-secondary-foreground',
    compilation: 'bg-accent text-accent-foreground',
  };

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
            {album.coverArtUrl ? (
              <Image
                src={album.coverArtUrl || "/placeholder.svg"}
                alt={album.title}
                fill
                className="object-cover grayscale"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Disc className="w-8 h-8 text-muted-foreground" />
              </div>
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
        {hasTracks && (
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
                Show {album.tracks?.length || 0} Tracks
              </>
            )}
          </Button>
        )}
      </div>

      {/* Track List */}
      {isExpanded && hasTracks && (
        <div className="border-t border-border bg-muted/20 p-4 space-y-3">
          {album.tracks?.map((track, idx) => (
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
                {track.previewUrl && (
                  <Button
                    size="sm"
                    variant={currentTrackIndex === idx ? 'default' : 'outline'}
                    onClick={() => setCurrentTrackIndex(currentTrackIndex === idx ? null : idx)}
                    className="flex-shrink-0"
                  >
                    {currentTrackIndex === idx ? 'Hide' : 'Preview'}
                  </Button>
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

          {album.tracks?.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No preview tracks available for this release
            </div>
          )}
        </div>
      )}
    </div>
  );
}
