'use client';

import { useState, useEffect } from 'react';
import { Disc, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlbumCard } from './album-card';
import type { Album } from '@/lib/types';
import type { ArtistCatalogDTO } from '@/lib/contracts/api';
import { apiFetchWithMeta } from '@/lib/client/api-fetch';

interface ArtistCatalogProps {
  artistMbid: string;
  artistName: string;
  initialData?: ArtistCatalogDTO;
}

type CatalogAlbum = Album & { tracks?: any[] };

function toCatalogAlbums(albums?: ArtistCatalogDTO['albums']): CatalogAlbum[] {
  if (!Array.isArray(albums)) return [];
  return albums.map((album) => ({
    ...album,
    coverArtUrl: album.coverArtUrl ?? undefined,
  })) as CatalogAlbum[];
}

export function ArtistCatalog({ artistMbid, artistName, initialData }: ArtistCatalogProps) {
  const [albums, setAlbums] = useState<CatalogAlbum[]>(toCatalogAlbums(initialData?.albums));
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'album' | 'ep' | 'single'>('all');
  const [mode, setMode] = useState<'preview' | 'deep-dive'>(initialData?.mode || 'preview');
  const [retryCount, setRetryCount] = useState(0);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [metaStatus, setMetaStatus] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(initialData?.emptyReason || null);

  const isTransientEmptyReason = (reason?: string) =>
    reason === 'rate_limited' || reason === 'mb_failed' || reason === 'provider_timeout';

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function fetchCatalog(attempt: number, refresh = false) {
      let shouldFinalize = true;
      try {
        setLoading(true);
        setError(null);
        const url = `/api/artists/${artistMbid}/catalog?mode=${mode}${refresh ? '&refresh=1' : ''}`;
        const cacheKey = `catalog:${artistMbid}:${mode}:${refresh ? 'refresh' : 'base'}`;
        const result = await apiFetchWithMeta<ArtistCatalogDTO>(url, {
          cacheKey,
          ttlMs: mode === 'deep-dive' ? 5 * 60_000 : 60_000,
          signal: controller.signal,
          shouldCache: (payload) => Array.isArray(payload?.albums) && payload.albums.length > 0,
          timeoutMs: mode === 'deep-dive' ? 30_000 : 20_000,
          retryCount: 1,
          retryDelayMs: 500,
        });
        if (!active) return;
        const data = result.data;
        const currentStatus = result.meta?.status as string | undefined;
        setMetaStatus(currentStatus || null);
        if (currentStatus === 'rate_limited' && attempt < 2) {
          shouldFinalize = false;
          await new Promise((resolve) => setTimeout(resolve, 1500));
          if (active) {
            await fetchCatalog(attempt + 1, true);
          }
          return;
        }
        const nextAlbums = toCatalogAlbums(data.albums);
        setInfoMessage((data as any)?.message || null);
        const currentEmptyReason = (data as any)?.emptyReason as string | undefined;
        setEmptyReason(currentEmptyReason || null);
        if (nextAlbums.length === 0 && currentStatus !== 'empty' && isTransientEmptyReason(currentEmptyReason)) {
          shouldFinalize = false;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            if (active) {
              await fetchCatalog(attempt + 1, true);
            }
            return;
          }
        }
        if (nextAlbums.length === 0 && attempt === 0 && mode === 'preview') {
          setRetryCount(1);
          await new Promise((resolve) => setTimeout(resolve, 800));
          if (active) {
            await fetchCatalog(1, true);
          }
          return;
        }
        console.log('[OffDaWallV2] Catalog loaded:', nextAlbums.length, 'albums');
        setAlbums(nextAlbums);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return;
        }
        console.error('[OffDaWallV2] Catalog fetch error:', err);
        if (active) {
          setError('Failed to load catalog');
          setInfoMessage(null);
          setMetaStatus(null);
          setEmptyReason(null);
        }
      } finally {
        if (active && shouldFinalize) {
          setLoading(false);
        }
      }
    }

    if (!(initialData && initialData.mode === mode && !retryCount)) {
      fetchCatalog(0);
    } else {
      setInfoMessage(initialData?.message || null);
      setEmptyReason(initialData?.emptyReason || null);
      setLoading(false);
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, [artistMbid, mode]);

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
        <p className="text-sm text-muted-foreground">
          {metaStatus === 'rate_limited'
            ? 'Rate limited, retrying catalog...'
            : retryCount > 0
              ? 'Retrying catalog fetch...'
              : 'Loading catalog...'}
        </p>
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
    const terminalEmpty =
      (metaStatus === 'empty' && !isTransientEmptyReason(emptyReason || undefined)) ||
      (!metaStatus && !isTransientEmptyReason(emptyReason || undefined));
    return (
      <div className="py-12 text-center">
        {terminalEmpty ? (
          <>
            <Disc className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {infoMessage || `No releases found for ${artistName}`}
            </p>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Fetching catalog from fallback sources...
            </p>
          </>
        )}
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
        {infoMessage && (
          <p className="text-sm text-muted-foreground mt-2">{infoMessage}</p>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="flex flex-wrap gap-3 border-b border-border pb-6">
        {(['preview', 'deep-dive'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setMode(option)}
            disabled={loading}
            className={`
              px-4 py-2 font-bold uppercase text-sm tracking-wider border-2 transition-all
              ${mode === option
                ? 'bg-primary text-primary-foreground border-primary transform -rotate-1'
                : 'bg-card text-foreground border-border hover:border-primary hover:text-primary'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {option === 'preview' ? 'Preview' : 'Deep-Dive'}
          </button>
        ))}
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

