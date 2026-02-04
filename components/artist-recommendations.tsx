'use client';

import { useState, useEffect } from 'react';
import { TrackCard } from './track-card';
import { AudioPlayer } from './audio-player';
import { Loader2 } from 'lucide-react';
import type { Recommendations, ScoredTrack } from '@/lib/recommendation-engine';
import type { ArtistRecommendationsDTO } from '@/lib/contracts/api';
import { getRecommendationReason } from '@/lib/recommendation-engine';
import { apiFetchWithMeta } from '@/lib/client/api-fetch';

interface ArtistRecommendationsProps {
  artistMbid: string;
  artistName: string;
  initialData?: ArtistRecommendationsDTO;
}

type Category = 'popular' | 'trending' | 'gems' | 'unique' | 'unpopular';

const CATEGORIES: { id: Category; label: string; description: string }[] = [
  { id: 'popular', label: 'Popular', description: 'Most played tracks' },
  { id: 'trending', label: 'Trending', description: 'Recent releases gaining traction' },
  { id: 'gems', label: 'Gems', description: 'Hidden gems deserving more attention' },
  { id: 'unique', label: 'Unique', description: 'Deep cuts and experimental tracks' },
  { id: 'unpopular', label: 'Unpopular', description: 'Rare finds for true fans' },
];

function normalizeRecommendations(
  input?: Record<string, any[]> | Recommendations | null
): Recommendations | null {
  if (!input) return null;
  return {
    popular: Array.isArray(input.popular) ? input.popular : [],
    trending: Array.isArray(input.trending) ? input.trending : [],
    gems: Array.isArray(input.gems) ? input.gems : [],
    unique: Array.isArray(input.unique) ? input.unique : [],
    unpopular: Array.isArray(input.unpopular) ? input.unpopular : [],
  };
}

export function ArtistRecommendations({ artistMbid, artistName, initialData }: ArtistRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendations | null>(
    normalizeRecommendations(initialData?.categories)
  );
  const [infoMessage, setInfoMessage] = useState<string | null>(initialData?.message || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('popular');
  const [currentTrack, setCurrentTrack] = useState<ScoredTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [metaStatus, setMetaStatus] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);

  const isTransientEmptyReason = (reason?: string) =>
    reason === 'rate_limited' || reason === 'provider_timeout';

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function fetchRecommendations(attempt: number, refresh = false) {
      let shouldFinalize = true;
      try {
        setLoading(true);
        setError(null);
        const url = `/api/artists/${artistMbid}/recommendations${refresh ? '?refresh=1' : ''}`;
        const result = await apiFetchWithMeta<ArtistRecommendationsDTO>(url, {
          cacheKey: `recommendations:${artistMbid}:${refresh ? 'refresh' : 'base'}`,
          ttlMs: 60_000,
          signal: controller.signal,
          shouldCache: (payload) =>
            payload && Object.values(payload).some((list: any) => Array.isArray(list) && list.length > 0),
          timeoutMs: 15_000,
          retryCount: 1,
          retryDelayMs: 400,
        });
        if (!active) return;
        const currentStatus = result.meta?.status as string | undefined;
        setMetaStatus(currentStatus || null);
        const currentEmptyReason = result.meta?.emptyReason as string | undefined;
        setEmptyReason(currentEmptyReason || null);
        if (currentStatus === 'rate_limited' && attempt < 2) {
          shouldFinalize = false;
          await new Promise((resolve) => setTimeout(resolve, 1500));
          if (active) {
            await fetchRecommendations(attempt + 1, true);
          }
          return;
        }
        const data = result.data;
        const categories = normalizeRecommendations(data.categories || data);
        if (!categories) {
          setRecommendations(null);
          return;
        }
        const hasAny = Object.values(categories || {}).some(
          (list) => Array.isArray(list) && list.length > 0
        );
        if (!hasAny && currentStatus !== 'empty' && isTransientEmptyReason(currentEmptyReason) && attempt < 2) {
          shouldFinalize = false;
          await new Promise((resolve) => setTimeout(resolve, 1200));
          if (active) {
            await fetchRecommendations(attempt + 1, true);
          }
          return;
        }
        if (!hasAny && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          if (active) {
            await fetchRecommendations(1, true);
          }
          return;
        }
        setRecommendations(categories);
        setInfoMessage(data.message || null);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return;
        }
        console.error('[OffDaWallV2] Recommendations fetch error:', err);
        if (active) {
          setError('Could not load recommendations');
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

    if (!initialData) {
      fetchRecommendations(0);
    } else {
      setLoading(false);
      setInfoMessage(initialData?.message || null);
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, [artistMbid]);

  const handlePlayTrack = (track: ScoredTrack) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const currentTracks = recommendations?.[activeCategory] || [];
  const isEmpty = !loading && currentTracks.length === 0;

  return (
    <div>
      {/* Section Header */}
      <div className="mb-12 relative">
        <div 
          className="absolute -top-8 left-0 text-primary font-bold uppercase text-xs tracking-wider transform -rotate-3"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          AI Curated for You →
        </div>
        
        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
          Recommendations
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Algorithmically curated tracks from {artistName}'s catalog across 5 unique categories
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-3 mb-8 border-b border-border pb-6">
        {CATEGORIES.map((category) => {
          const count = recommendations?.[category.id]?.length || 0;
          const isActive = activeCategory === category.id;
          
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              disabled={loading}
              className={`
                px-4 py-2 font-bold uppercase text-sm tracking-wider border-2 transition-all
                ${isActive 
                  ? 'bg-primary text-primary-foreground border-primary transform -rotate-1' 
                  : 'bg-card text-foreground border-border hover:border-primary hover:text-primary'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {category.label}
              {!loading && count > 0 && (
                <span className="ml-2 font-mono text-xs">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Category Description */}
      {!loading && (
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            {CATEGORIES.find(c => c.id === activeCategory)?.description}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="ml-3 text-sm text-muted-foreground">
            {metaStatus === 'rate_limited' ? 'Rate limited, retrying recommendations...' : 'Loading recommendations...'}
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-card border-2 border-destructive p-8 text-center">
          <p className="text-destructive font-bold mb-2">Failed to Load Recommendations</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="bg-card border-2 border-border p-12 text-center">
          {metaStatus === 'empty' && !isTransientEmptyReason(emptyReason || undefined) ? (
            <>
              <div className="text-4xl mb-4">🎵</div>
              <h3 className="text-xl font-bold mb-2">No Tracks Found</h3>
              <p className="text-sm text-muted-foreground">
                {infoMessage || `No tracks match the ${activeCategory} criteria. Try a different category.`}
              </p>
            </>
          ) : (
            <>
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Fetching Recommendations...</h3>
              <p className="text-sm text-muted-foreground">
                We are waiting on fallback providers. This usually resolves shortly.
              </p>
            </>
          )}
        </div>
      )}

      {/* Track Grid */}
      {!loading && !error && currentTracks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentTracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              reason={getRecommendationReason(track, activeCategory)}
              onPlay={handlePlayTrack}
              isPlaying={currentTrack?.id === track.id && isPlaying}
            />
          ))}
        </div>
      )}

      {/* Audio Player */}
      {currentTrack && currentTrack.previewUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <AudioPlayer
            previewUrl={currentTrack.previewUrl}
            trackTitle={currentTrack.title}
            artistName={currentTrack.artistName}
            isPlaying={isPlaying}
            onPlayPause={setIsPlaying}
            onEnded={() => setIsPlaying(false)}
          />
        </div>
      )}
    </div>
  );
}

