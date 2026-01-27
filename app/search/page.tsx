'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { SearchX } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ArtistSkeleton } from '@/components/artist-skeleton';
import { getAllGenres } from '@/lib/genres';
import type { Artist } from '@/lib/types';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  const genreFilter = searchParams.get('genre');
  
  const [results, setResults] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(genreFilter);
  
  const genres = getAllGenres();

  useEffect(() => {
    if (!query) return;

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const url = selectedGenre 
          ? `/api/search?q=${encodeURIComponent(query)}&genre=${encodeURIComponent(selectedGenre)}`
          : `/api/search?q=${encodeURIComponent(query)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        setResults(data.results || []);
      } catch (error) {
        console.error('[OffDaWallV2] Search results error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [query, selectedGenre]);

  if (!query) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <p className="text-muted-foreground text-center">Enter a search query to find artists</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <Breadcrumbs items={[{ label: 'Search', href: '/search' }, { label: query }]} />

        {/* Search Header */}
        <div className="mb-8">
          <div className="inline-block mb-4">
            <div 
              className="text-primary font-bold uppercase text-xs tracking-wider px-3 py-1 border-2 border-primary transform -rotate-1"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              Search Results
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
            Results for &quot;{query}&quot;
          </h1>

          {!isLoading && (
            <p className="text-lg text-muted-foreground">
              Found {results.length} artist{results.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Genre Filter */}
        <div className="mb-8 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedGenre(null)}
            className={`px-4 py-2 text-sm font-medium rounded border-2 transition-colors ${
              !selectedGenre 
                ? 'border-primary bg-primary text-primary-foreground' 
                : 'border-border hover:border-primary'
            }`}
          >
            All Genres
          </button>
          {genres.map((genre) => (
            <button
              key={genre.slug}
              onClick={() => setSelectedGenre(genre.slug)}
              className={`px-4 py-2 text-sm font-medium rounded border-2 transition-colors ${
                selectedGenre === genre.slug 
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : 'border-border hover:border-primary'
              }`}
            >
              {genre.name}
            </button>
          ))}
        </div>

        {/* Results Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <ArtistSkeleton key={i} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <SearchX className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Results Found</h2>
            <p className="text-muted-foreground mb-6">
              Try adjusting your search or filter settings
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded hover:bg-primary/90 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {results.map((artist, index) => (
              <Link
                key={artist.mbid}
                href={`/artists/${artist.mbid}`}
                className="group"
                style={{
                  transform: `rotate(${(index % 3 - 1) * 0.5}deg)`,
                }}
              >
                <div className="bg-card border-2 border-border p-4 transition-all hover:border-primary hover:rotate-0 hover:scale-105">
                  {artist.image && (
                    <div className="relative aspect-square mb-3 overflow-hidden">
                      <Image
                        src={artist.image || "/placeholder.svg"}
                        alt={artist.name}
                        fill
                        className="object-cover grayscale group-hover:grayscale-0 transition-all"
                      />
                    </div>
                  )}
                  <h3 className="font-black text-lg mb-1 leading-tight">{artist.name}</h3>
                  {artist.genres && artist.genres.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {artist.genres.slice(0, 2).join(', ')}
                    </p>
                  )}
                  {artist.country && (
                    <p className="text-xs text-muted-foreground mt-1">{artist.country}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <ArtistSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    }>
      <SearchResults />
    </Suspense>
  );
}

