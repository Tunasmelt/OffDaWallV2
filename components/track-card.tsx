'use client';

import { Play, Pause } from 'lucide-react';
import { useState } from 'react';
import type { ScoredTrack } from '@/lib/recommendation-engine';
import { FallbackImage } from '@/components/ui/fallback-image';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';

interface TrackCardProps {
  track: ScoredTrack;
  reason?: string;
  onPlay: (track: ScoredTrack) => void;
  isPlaying: boolean;
}

export function TrackCard({ track, reason, onPlay, isPlaying }: TrackCardProps) {
  const [imageError, setImageError] = useState(false);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={`group relative bg-card border border-border p-4 transform transition-all duration-300 hover:scale-105 hover:-rotate-1 hover:border-primary hover:shadow-lg ${track.previewUrl ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={() => track.previewUrl && onPlay(track)}
      style={{
        clipPath: 'polygon(0 0, 100% 0, 100% 97%, 95% 100%, 0 100%)',
      }}
    >
      {/* Handwritten style label */}
      {reason && (
        <div 
          className="absolute -top-3 -left-2 bg-primary text-primary-foreground px-2 py-1 text-xs font-bold uppercase transform -rotate-3 z-10"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          ★
        </div>
      )}

      <div className="flex gap-4">
        {/* Album Art */}
        <div className="flex-shrink-0 w-16 h-16 bg-muted relative overflow-hidden group-hover:ring-2 group-hover:ring-primary transition-all">
          {track.albumArt && !imageError ? (
            <FallbackImage
              src={track.albumArt || "/placeholder.svg"}
              alt={track.title}
              fill
              className="object-cover grayscale group-hover:grayscale-0 transition-all"
              sizes="64px"
              fallbackSrc="/placeholder.svg"
              onError={() => setImageError(true)}
            />
          ) : (
            <ImagePlaceholder label={track.title} textClassName="text-2xl" className="border-none" />
          )}
          
          {/* Play button overlay */}
          {track.previewUrl && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-6 h-6 text-primary" />
              ) : (
                <Play className="w-6 h-6 text-primary fill-primary" />
              )}
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm leading-tight mb-1 truncate group-hover:text-primary transition-colors">
            {track.title}
          </h4>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            {track.trackNumber && (
              <span className="font-mono">#{track.trackNumber}</span>
            )}
            <span>{formatDuration(track.duration)}</span>
            {track.releaseDate && (
              <span>• {track.releaseDate.split('-')[0]}</span>
            )}
          </div>

          {/* Score indicators */}
          <div className="flex gap-1">
            {track.popularityScore > 0.6 && (
              <div className="h-1 w-8 bg-primary" title="Popular" />
            )}
            {track.recencyScore > 0.6 && (
              <div className="h-1 w-8 bg-chart-2" title="Recent" />
            )}
            {track.uniquenessScore > 0.6 && (
              <div className="h-1 w-8 bg-chart-3" title="Unique" />
            )}
          </div>

          {/* Reason tooltip */}
          {reason && (
            <p className="text-xs text-muted-foreground mt-2 leading-tight">
              {reason}
            </p>
          )}
        </div>
      </div>

      {/* No preview indicator */}
      {!track.previewUrl && (
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground opacity-50">
          No preview
        </div>
      )}
    </div>
  );
}
