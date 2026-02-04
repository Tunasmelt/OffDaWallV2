'use client';

import { useState } from 'react';
import { FallbackImage } from '@/components/ui/fallback-image';
import { useArtistImage } from './hooks/use-artist-image';
import type { Artist } from '@/lib/types';

interface ArtistHeroProps {
  artist: Artist;
}

export function ArtistHero({ artist }: ArtistHeroProps) {
  const formatCount = (value: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

  const normalizeUrl = (value?: string) => {
    if (!value) return null;
    if (!value.includes('.')) return null;
    return value.startsWith('http') ? value : `https://${value}`;
  };

  const websiteUrl = normalizeUrl(artist.website);
  const facebookUrl = normalizeUrl(artist.facebook);
  const twitterUrl = normalizeUrl(artist.twitter);
  const [imageError, setImageError] = useState(false);
  const resolvedHeroImage = useArtistImage(artist, true, imageError);
  const heroImage = resolvedHeroImage || artist.imageUrl || artist.image;
  const fans = artist.listeners ?? artist.followers;

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
      
      {/* Texture overlay */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V%200h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V%200H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="container mx-auto px-4 py-16 md:py-24 relative">
        <div className="grid md:grid-cols-[300px,1fr] lg:grid-cols-[400px,1fr] gap-12 items-start">
          {/* Artist Image */}
          <div className="relative">
            {/* Handwritten label */}
            <div 
              className="absolute -top-6 -left-4 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold uppercase transform -rotate-3 z-10"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              Artist Profile
            </div>
            
            <div
              className="relative w-full max-w-[360px] md:max-w-[420px] mx-auto md:mx-0 border-4 border-border bg-card overflow-hidden transform rotate-1 hover:rotate-0 transition-transform duration-300"
              style={{ aspectRatio: '1 / 1' }}
            >
              {heroImage ? (
                <FallbackImage
                  src={heroImage || "/placeholder.svg"}
                  alt={artist.name}
                  fill
                  className="object-cover grayscale hover:grayscale-0 transition-all duration-300"
                  sizes="(max-width: 768px) 100vw, 400px"
                  fallbackSrc="/placeholder.svg"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <div className="text-6xl md:text-8xl font-black text-primary opacity-20">
                    {artist.name.charAt(0)}
                  </div>
                </div>
              )}
              
              {/* Red accent overlay on hover */}
              <div className="absolute inset-0 bg-primary/0 hover:bg-primary/10 transition-colors duration-300" />
            </div>
          </div>

          {/* Artist Info */}
          <div className="space-y-6">
            {/* Name */}
            <div>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-foreground mb-4 leading-none text-balance">
                {artist.name}
              </h1>
              
              {/* Type badge */}
              {artist.type && (
                <div className="inline-block">
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {artist.type}
                  </span>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {artist.country && (
                <div className="bg-card border border-border p-4">
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Origin
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {artist.country}
                  </div>
                </div>
              )}
              
              {artist.beginDate && (
                <div className="bg-card border border-border p-4">
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Active Since
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {new Date(artist.beginDate).getFullYear()}
                  </div>
                </div>
              )}
              
              {artist.popularity && (
                <div className="bg-card border border-border p-4">
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Popularity
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {Math.round(artist.popularity * 100)}%
                  </div>
                </div>
              )}

              {typeof fans === 'number' && fans > 0 && (
                <div className="bg-card border border-border p-4">
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Fans
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {formatCount(fans)}
                  </div>
                </div>
              )}
              
              {artist.genres && artist.genres.length > 0 && (
                <div className="bg-card border border-border p-4">
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Genres
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {artist.genres.length}
                  </div>
                </div>
              )}
            </div>

            {/* Genre Tags */}
            {artist.genres && artist.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {artist.genres.slice(0, 6).map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 text-xs font-medium bg-muted text-foreground border border-border uppercase tracking-wider"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Social Links */}
            {(websiteUrl || facebookUrl || twitterUrl) && (
              <div className="flex flex-wrap gap-3 pt-4">
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium bg-card border border-border hover:border-primary hover:text-primary transition-colors"
                  >
                    Website
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium bg-card border border-border hover:border-primary hover:text-primary transition-colors"
                  >
                    Facebook
                  </a>
                )}
                {twitterUrl && (
                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium bg-card border border-border hover:border-primary hover:text-primary transition-colors"
                  >
                    Twitter
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

