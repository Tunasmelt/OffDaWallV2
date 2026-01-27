'use client';

import { useState } from 'react';
import type { Artist } from '@/lib/types';

interface ArtistBioProps {
  artist: Artist;
}

export function ArtistBio({ artist }: ArtistBioProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!artist.bio) {
    return null;
  }

  const bioText = artist.bio;
  const isLong = bioText.length > 500;
  const displayText = isExpanded || !isLong ? bioText : `${bioText.slice(0, 500)}...`;

  return (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <div className="max-w-4xl">
        {/* Section Header */}
        <div className="mb-8 relative">
          <div 
            className="absolute -top-6 left-0 text-primary font-bold uppercase text-xs tracking-wider transform -rotate-2"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            The Story →
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">
            Biography
          </h2>
        </div>

        {/* Bio Content */}
        <div className="prose prose-invert max-w-none">
          <p className="text-lg leading-relaxed text-muted-foreground whitespace-pre-line">
            {displayText}
          </p>
          
          {isLong && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-4 text-primary font-medium hover:underline"
            >
              {isExpanded ? 'Show Less' : 'Read More'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
