'use client';

import PrefetchLink from './prefetch-link'; // Ensure PrefetchLink is imported
import { useEffect, useRef, useState } from 'react';
import { FallbackImage } from '@/components/ui/fallback-image';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import type { Artist } from '@/lib/types';
import { useArtistImage } from './hooks/use-artist-image';
import { isValidUuid } from '@/lib/ids';

interface ArtistCardProps {
  artist: Artist;
  index: number;
  featured?: boolean;
  fallbackImageUrl?: string | null;
}

export function ArtistCard({ artist, index, featured = false, fallbackImageUrl }: ArtistCardProps) {
  // Rotation for collage effect
  const rotation = index % 3 === 0 ? -2 : index % 3 === 1 ? 1 : -1;
  const cardRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(index < 8);
  const [imageError, setImageError] = useState(false);
  const imageUrl = useArtistImage(artist, isVisible, imageError);
  const imageSrc = imageUrl || artist.image || fallbackImageUrl || "/placeholder-user.jpg";
  const hasArtistLink = isValidUuid(artist.mbid || '');

  useEffect(() => {
    if (index < 8) return;
    const element = cardRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '180px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [index]);
  
  const card = (
      <article
        ref={cardRef}
        className="group relative bg-card border border-border overflow-hidden transition-all duration-300 hover:border-primary hover:shadow-xl"
        style={{
          transform: `rotate(${rotation}deg)`,
        }}
      >
          {/* Artist Image */}
          <div className="aspect-square relative overflow-hidden bg-muted">
            {imageSrc ? (
              <FallbackImage
                src={imageSrc}
                alt={artist.name}
                fill
                className="object-cover transition-all duration-500 group-hover:scale-110"
                style={{
                  filter: 'grayscale(100%)',
                }}
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                fallbackSrc={fallbackImageUrl || "/placeholder-user.jpg"}
                onError={() => setImageError(true)}
              />
            ) : (
              <ImagePlaceholder
                label={artist.name}
                className="bg-gradient-to-br from-muted to-background"
                textClassName="text-6xl"
              />
            )}
            
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300" />
            
            {/* Red accent for featured artists */}
            {featured && (
              <div className="absolute top-2 right-2">
                <div className="bg-primary text-primary-foreground px-2 py-1 text-xs font-bold uppercase tracking-wider transform rotate-3">
                  Top
                </div>
              </div>
            )}
          </div>
          
          {/* Artist Info */}
          <div className="p-4 bg-card">
            <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-2">
              {artist.name}
            </h3>
            
            {artist.area && (
              <p className="text-sm text-muted-foreground">
                {artist.area}
              </p>
            )}
            
            {/* Tags */}
            {artist.tags && artist.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {artist.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-muted text-muted-foreground border border-border"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Torn paper effect */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: 'repeating-linear-gradient(90deg, transparent, transparent 2px, oklch(var(--primary)) 2px, oklch(var(--primary)) 4px)',
            }}
          />
      </article>
  );

  if (!hasArtistLink) {
    return (
      <div className="cursor-default" aria-label={artist.name}>
        {card}
      </div>
    );
  }

  return (
    <PrefetchLink href={`/artists/${artist.mbid}`}>
      {card}
    </PrefetchLink>
  );
}
