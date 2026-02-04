'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { RelatedArtist } from '@/lib/types';
import { useArtistImage } from './hooks/use-artist-image';
import { FallbackImage } from '@/components/ui/fallback-image';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { isValidUuid } from '@/lib/ids';

interface RelatedArtistsProps {
  relatedArtists: RelatedArtist[];
}

export function RelatedArtists({ relatedArtists }: RelatedArtistsProps) {
  if (!relatedArtists || relatedArtists.length === 0) {
    return null;
  }

  return (
    <section className="container mx-auto px-4 py-12 md:py-16 border-t border-border">
      <div className="mb-12 relative">
        <div 
          className="absolute -top-6 left-0 text-primary font-bold uppercase text-xs tracking-wider transform -rotate-2"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          Connections →
        </div>
        
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
          Related Artists
        </h2>
        <p className="text-muted-foreground text-lg">
          Artists with similar sounds and influences
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
        {relatedArtists.slice(0, 10).map((relatedArtist, index) => (
          <RelatedArtistCard
            key={`${relatedArtist.mbid || relatedArtist.name}-${index}`}
            relatedArtist={relatedArtist}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}

function RelatedArtistCard({
  relatedArtist,
  index,
}: {
  relatedArtist: RelatedArtist;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(index < 8);
  const [imageError, setImageError] = useState(false);

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
      { rootMargin: '200px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [index]);

  const imageUrl = useArtistImage(relatedArtist, isVisible, imageError);
  const finalImage = imageUrl || relatedArtist.imageUrl || relatedArtist.image;
  const hasArtistLink = isValidUuid(relatedArtist.mbid || '');

  const card = (
    <div ref={cardRef}>
      <div 
        className="relative aspect-square border-2 border-border bg-card overflow-hidden mb-3 transition-all duration-300 hover:border-primary"
        style={{
          transform: `rotate(${index % 3 === 0 ? '2deg' : index % 3 === 1 ? '-2deg' : '0deg'})`,
        }}
      >
        {finalImage ? (
          <FallbackImage
            src={finalImage || "/placeholder.svg"}
            alt={relatedArtist.name}
            fill
            className="object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            fallbackSrc="/placeholder.svg"
            onError={() => setImageError(true)}
          />
        ) : (
          <ImagePlaceholder label={relatedArtist.name} textClassName="text-3xl text-primary" />
        )}
        
        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300" />
      </div>
      
      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
        {relatedArtist.name}
      </h3>
      
      {relatedArtist.type && (
        <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
          {relatedArtist.type}
        </p>
      )}
    </div>
  );

  if (!hasArtistLink) {
    return <div className="group cursor-default">{card}</div>;
  }

  return (
    <Link
      href={`/artists/${relatedArtist.mbid}`}
      className="group"
    >
      {card}
    </Link>
  );
}
