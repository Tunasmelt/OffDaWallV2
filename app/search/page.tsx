'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ArtistSkeleton } from '@/components/artist-skeleton';
import type { Artist } from '@/lib/types';
import { useArtistImage } from '@/components/hooks/use-artist-image';
import { FallbackImage } from '@/components/ui/fallback-image';
import { fetchJsonCached } from '@/lib/client/fetch-json';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  const [results, setResults] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!query) return;

    const controller = new AbortController();
    let active = true;

    const fetchResults = async (attempt: number) => {
      setIsLoading(true);
      try {
        const url = `/api/search?q=${encodeURIComponent(query)}&details=1`;
        const data = await fetchJsonCached<{ results?: Artist[] }>(url, {
          cacheKey: `search:${query}:details`,
          ttlMs: 30_000,
          signal: controller.signal,
          shouldCache: (payload) => Array.isArray(payload?.results) && payload.results.length > 0,
        });
        if (!active) return;
        const nextResults = data.results || [];
        if (nextResults.length === 0 && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (active) {
            await fetchResults(1);
          }
          return;
        }
        setResults(nextResults);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          return;
        }
        console.error('[OffDaWallV2] Search results error:', error);
        if (active) {
          setResults([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchResults(0);
    return () => {
      active = false;
      controller.abort();
    };
  }, [query]);

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
              <SearchResultCard key={artist.mbid} artist={artist} index={index} />
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

function SearchResultCard({ artist, index }: { artist: Artist; index: number }) {
  const shouldFetchImage = index < 12;
  const [imageError, setImageError] = useState(false);
  const imageUrl = useArtistImage(artist, shouldFetchImage, imageError);
  const resolvedImage = imageUrl || artist.imageUrl || artist.image;
  const hasArtistLink = Boolean(artist.mbid);

  const card = (
    <div className="bg-card border-2 border-border p-4 transition-all hover:border-primary hover:rotate-0 hover:scale-105">
      {resolvedImage ? (
        <div className="relative aspect-square mb-3 overflow-hidden">
          <FallbackImage
            src={resolvedImage || "/placeholder.svg"}
            alt={artist.name}
            fill
            className="object-cover grayscale group-hover:grayscale-0 transition-all"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            fallbackSrc="/placeholder.svg"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className="relative aspect-square mb-3 overflow-hidden">
          <ImagePlaceholder label={artist.name} textClassName="text-5xl" />
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
  );

  if (!hasArtistLink) {
    return (
      <div
        className="group"
        style={{
          transform: `rotate(${(index % 3 - 1) * 0.5}deg)`,
        }}
      >
        {card}
      </div>
    );
  }

  return (
    <Link
      href={`/artists/${artist.mbid}`}
      className="group"
      style={{
        transform: `rotate(${(index % 3 - 1) * 0.5}deg)`,
      }}
    >
      {card}
    </Link>
  );
}

