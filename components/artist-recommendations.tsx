'use client';

import { useState, useEffect } from 'react';
import { TrackCard } from './track-card';
import { AudioPlayer } from './audio-player';
import { Loader2 } from 'lucide-react';
import type { Recommendations, ScoredTrack } from '@/lib/recommendation-engine';
import { getRecommendationReason } from '@/lib/recommendation-engine';
import { fetchJsonCached } from '@/lib/client/fetch-json';

interface ArtistRecommendationsProps {
  artistMbid: string;
  artistName: string;
}

type Category = 'popular' | 'trending' | 'gems' | 'unique' | 'unpopular';

const CATEGORIES: { id: Category; label: string; description: string }[] = [
  { id: 'popular', label: 'Popular', description: 'Most played tracks' },
  { id: 'trending', label: 'Trending', description: 'Recent releases gaining traction' },
  { id: 'gems', label: 'Gems', description: 'Hidden gems deserving more attention' },
  { id: 'unique', label: 'Unique', description: 'Deep cuts and experimental tracks' },
  { id: 'unpopular', label: 'Unpopular', description: 'Rare finds for true fans' },
];

export function ArtistRecommendations({ artistMbid, artistName }: ArtistRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('popular');
  const [currentTrack, setCurrentTrack] = useState<ScoredTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function fetchRecommendations(attempt: number, refresh = false) {
      try {
        setLoading(true);
        setError(null);
        const url = `/api/artists/${artistMbid}/recommendations${refresh ? '?refresh=1' : ''}`;
        const data = await fetchJsonCached<Recommendations>(url, {
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
        const hasAny = Object.values(data || {}).some(
          (list) => Array.isArray(list) && list.length > 0
        );
        if (!hasAny && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          if (active) {
            await fetchRecommendations(1, true);
          }
          return;
        }
        setRecommendations(data);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return;
        }
        console.error('[OffDaWallV2] Recommendations fetch error:', err);
        if (active) {
          setError('Could not load recommendations');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchRecommendations(0);
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
          <div className="text-4xl mb-4">🎵</div>
          <h3 className="text-xl font-bold mb-2">No Tracks Found</h3>
          <p className="text-sm text-muted-foreground">
            No tracks match the {activeCategory} criteria. Try a different category.
          </p>
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

