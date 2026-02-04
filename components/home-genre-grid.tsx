'use client';

import { useEffect, useMemo, useState } from 'react';
import { GenreCard } from '@/components/genre-card';
import type { Genre } from '@/lib/types';
import type { ApiResponse, GenresPreviewDTO } from '@/lib/contracts/api';

type Props = {
  initialGenres: Genre[];
  initialStatus?: string;
};

function mergeGenrePreviews(base: Genre[], incoming: Genre[]) {
  const bySlug = new Map(incoming.map((genre) => [genre.slug, genre]));
  return base.map((genre) => {
    const next = bySlug.get(genre.slug);
    if (!next) return genre;
    return {
      ...genre,
      previewArtists:
        next.previewArtists && next.previewArtists.length > 0
          ? next.previewArtists
          : genre.previewArtists,
      previewImageUrl: next.previewImageUrl || genre.previewImageUrl,
    };
  });
}

export function HomeGenreGrid({ initialGenres, initialStatus }: Props) {
  const [genres, setGenres] = useState<Genre[]>(initialGenres);

  const needsHydration = useMemo(() => {
    if (initialStatus === 'partial' || initialStatus === 'empty') return true;
    return initialGenres.some((genre) => !genre.previewImageUrl);
  }, [initialGenres, initialStatus]);

  useEffect(() => {
    if (!needsHydration) return;
    const controller = new AbortController();

    const hydrate = async () => {
      try {
        const res = await fetch('/api/genres?preview=1&refresh=1', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) return;
        const payload = (await res.json()) as ApiResponse<GenresPreviewDTO>;
        if (payload?.ok !== true || !Array.isArray(payload?.data?.genres)) return;
        setGenres((current) => mergeGenrePreviews(current, payload.data.genres as Genre[]));
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
      }
    };

    const t = setTimeout(hydrate, 700);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [needsHydration]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-12">
      {genres.map((genre, index) => (
        <GenreCard key={genre.slug} genre={genre} index={index} />
      ))}
    </div>
  );
}

