'use client';

import { useState, useEffect } from 'react';
import { Disc, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlbumCard } from './album-card';
import type { Album } from '@/lib/types';

interface ArtistCatalogProps {
  artistMbid: string;
  artistName: string;
}

export function ArtistCatalog({ artistMbid, artistName }: ArtistCatalogProps) {
  const [albums, setAlbums] = useState<(Album & { tracks?: any[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'album' | 'ep' | 'single'>('all');

  useEffect(() => {
    async function fetchCatalog() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/artists/${artistMbid}/catalog`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch catalog');
        }

        const data = await response.json();
        console.log('[OffDaWallV2] Catalog loaded:', data.albums.length, 'albums');
        setAlbums(data.albums || []);
      } catch (err) {
        console.error('[OffDaWallV2] Catalog fetch error:', err);
        setError('Failed to load catalog');
      } finally {
        setLoading(false);
      }
    }

    fetchCatalog();
  }, [artistMbid]);

  const filteredAlbums = filter === 'all' 
    ? albums 
    : albums.filter(album => album.type === filter);

  const sortedAlbums = [...filteredAlbums].sort((a, b) => {
    const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
    const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
    return dateB - dateA; // Most recent first
  });

  const albumCount = albums.filter(a => a.type === 'album').length;
  const epCount = albums.filter(a => a.type === 'ep').length;
  const singleCount = albums.filter(a => a.type === 'single').length;

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading catalog...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block p-4 bg-destructive/10 border border-destructive/20 mb-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="py-12 text-center">
        <Disc className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No releases found for {artistName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="relative">
        <div 
          className="absolute -top-6 left-0 text-primary font-bold uppercase text-xs tracking-wider transform -rotate-2"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          Full Discography →
        </div>
        <h2 className="text-4xl font-black tracking-tight">Music Catalog</h2>
        <p className="text-muted-foreground mt-2">
          {albums.length} releases • {albumCount} albums • {epCount} EPs • {singleCount} singles
        </p>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto">
          <TabsTrigger 
            value="all" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            All ({albums.length})
          </TabsTrigger>
          <TabsTrigger 
            value="album"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            Albums ({albumCount})
          </TabsTrigger>
          <TabsTrigger 
            value="ep"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            EPs ({epCount})
          </TabsTrigger>
          <TabsTrigger 
            value="single"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            Singles ({singleCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sortedAlbums.map((album, idx) => (
              <AlbumCard key={album.mbid} album={album} index={idx} />
            ))}
          </div>

          {sortedAlbums.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                No {filter}s found
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

