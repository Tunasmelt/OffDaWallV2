'use client';

import React from "react"

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Artist } from '@/lib/types';
import { useArtistImage } from './hooks/use-artist-image';
import { FallbackImage } from '@/components/ui/fallback-image';
import { fetchJsonCached } from '@/lib/client/fetch-json';

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search for autocomplete
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const data = await fetchJsonCached<{ results?: Artist[] }>(
        `/api/search?q=${encodeURIComponent(searchQuery)}`,
        {
          cacheKey: `search-suggest:${searchQuery}`,
          ttlMs: 15_000,
          signal: controller.signal,
        }
      );
      setSuggestions(data.results?.slice(0, 5) || []);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        return;
      }
      console.error('[OffDaWallV2] Autocomplete error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(true);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce autocomplete
    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      setShowSuggestions(false);
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  // Keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="global-search"
          type="text"
          placeholder="Search artists... (⌘K)"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          className="pl-10 pr-10 bg-card border-border"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </form>

      {/* Autocomplete Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-card border border-border rounded shadow-lg z-50 overflow-hidden">
          <div className="p-2 space-y-1">
            {suggestions.map((artist) => (
              <SuggestionItem
                key={artist.mbid}
                artist={artist}
                onSelect={() => {
                  setShowSuggestions(false);
                  setQuery('');
                }}
              />
            ))}
          </div>
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            >
              See all results for &quot;{query}&quot;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionItem({
  artist,
  onSelect,
}: {
  artist: Artist;
  onSelect: () => void;
}) {
  const imageUrl = useArtistImage(artist, true);
  const resolvedImage = imageUrl || artist.imageUrl || artist.image;

  return (
    <Link
      href={`/artists/${artist.mbid}`}
      onClick={onSelect}
      className="flex items-center gap-3 p-2 rounded hover:bg-muted transition-colors"
    >
      {resolvedImage && (
        <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0 grayscale">
          <FallbackImage
            src={resolvedImage || "/placeholder.svg"}
            alt={artist.name}
            fill
            className="object-cover"
            fallbackSrc="/placeholder.svg"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{artist.name}</div>
        {artist.genres && artist.genres.length > 0 && (
          <div className="text-xs text-muted-foreground truncate">
            {artist.genres.slice(0, 2).join(', ')}
          </div>
        )}
      </div>
    </Link>
  );
}

