'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Genre } from '@/lib/types';
import { normalizeImageUrl } from '@/lib/images';
import { FallbackImage } from '@/components/ui/fallback-image';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';

interface GenreCardProps {
  genre: Genre;
  index: number;
}

export function GenreCard({ genre, index }: GenreCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const previewUrl =
    normalizeImageUrl(
      genre.previewImageUrl ||
        genre.previewArtists?.[0]?.image ||
        genre.previewArtists?.[0]?.imageUrl
    ) || null;
  const [imageFailed, setImageFailed] = useState(false);
  const transparentFallback = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  
  // Stagger rotation angles for collage effect
  const rotations = [-2, 1, -1, 2, -3, 1, -2, 3, -1, 2];
  const rotation = rotations[index % rotations.length];

  return (
    <Link
      href={`/genres/${genre.slug}`}
      className="group relative block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: 'all 0.3s ease',
      }}
    >
      <div 
        className="relative overflow-hidden bg-card border-2 border-border hover:border-primary transition-all duration-300"
        style={{
          transform: isHovered ? 'scale(1.05) rotate(0deg)' : 'scale(1)',
          boxShadow: isHovered ? '0 8px 16px rgba(0,0,0,0.8)' : '0 4px 8px rgba(0,0,0,0.5)',
        }}
      >
        {/* Torn paper edge effect */}
        <div 
          className="absolute top-0 left-0 right-0 h-2 bg-background"
          style={{
            clipPath: 'polygon(0 0, 5% 100%, 10% 0, 15% 100%, 20% 0, 25% 100%, 30% 0, 35% 100%, 40% 0, 45% 100%, 50% 0, 55% 100%, 60% 0, 65% 100%, 70% 0, 75% 100%, 80% 0, 85% 100%, 90% 0, 95% 100%, 100% 0)',
          }}
        />
        
        {/* Placeholder image with grayscale filter */}
        <div className="aspect-square bg-gradient-to-br from-muted to-card relative overflow-hidden">
          {previewUrl && !imageFailed && (
            <FallbackImage
              src={previewUrl}
              alt={`${genre.name} artist preview`}
              fill
              className="object-cover grayscale"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
              fallbackSrc={transparentFallback}
              onError={() => setImageFailed(true)}
            />
          )}
          {!previewUrl || imageFailed ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImagePlaceholder label={genre.name} textClassName="text-6xl" className="bg-transparent border-none" />
            </div>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-transparent z-10" />
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V%200h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V%200H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Genre name overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
            <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
              {genre.name}
            </h3>
          </div>
          
          {/* Red accent on hover */}
          <div 
            className="absolute inset-0 bg-primary/20 transition-opacity duration-300 z-0"
            style={{ opacity: isHovered ? 1 : 0 }}
          />
        </div>
        
        {/* Description */}
        <div className="p-4 bg-card">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {genre.description}
          </p>
        </div>
        
        {/* Handwritten-style label */}
        <div 
          className="absolute top-2 right-2 bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transform rotate-6 shadow-lg"
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            letterSpacing: '0.08em',
          }}
        >
          Explore
        </div>
      </div>
    </Link>
  );
}

