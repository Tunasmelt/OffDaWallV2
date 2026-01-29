'use client';

import { useEffect, useState } from 'react';
import type { Artist } from '@/lib/types';
import { normalizeImageUrl } from '@/lib/images';

const imageCache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();
const queue: Array<() => Promise<void>> = [];
let activeCount = 0;
const MAX_CONCURRENT = 3;
const STAGGER_MS = 150;
const failureCache = new Map<string, { at: number; count: number }>();
const FAILURE_COOLDOWN_MS = 60_000;

function runQueue() {
  if (activeCount >= MAX_CONCURRENT) return;
  const job = queue.shift();
  if (!job) return;
  activeCount += 1;
  job()
    .catch(() => {})
    .finally(() => {
      activeCount -= 1;
      setTimeout(runQueue, STAGGER_MS);
    });
}

function enqueue(job: () => Promise<void>) {
  queue.push(job);
  runQueue();
}

function getCacheKey(artist: Artist) {
  return artist.mbid || artist.name?.toLowerCase() || '';
}

export function useArtistImage(artist: Artist, enabled: boolean = true, forceFetch: boolean = false) {
  const initial = normalizeImageUrl(artist.imageUrl || artist.image) || null;
  const [imageUrl, setImageUrl] = useState<string | null>(initial);

  useEffect(() => {
    if (!enabled) return;
    if (imageUrl && !forceFetch) return;

    const key = getCacheKey(artist);
    if (!key) return;

    if (!forceFetch && imageCache.has(key)) {
      setImageUrl(imageCache.get(key) || null);
      return;
    }

    const failure = failureCache.get(key);
    if (failure && Date.now() - failure.at < FAILURE_COOLDOWN_MS) {
      return;
    }

    let request = inFlight.get(key);
    if (!request) {
      const params = new URLSearchParams();
      if (artist.mbid) params.set('mbid', artist.mbid);
      if (artist.name) params.set('name', artist.name);

      request = new Promise<string | null>((resolve) => {
        enqueue(async () => {
          try {
            const payload = await fetch(`/api/artist-image?${params.toString()}`)
              .then((res) => res.json());
            const data = payload?.ok ? payload.data : payload;
            resolve(normalizeImageUrl(data?.imageUrl) || null);
          } catch {
            resolve(null);
          } finally {
            inFlight.delete(key);
          }
        });
      });

      inFlight.set(key, request);
    }

    request.then((url) => {
      if (url) {
        imageCache.set(key, url);
      } else {
        const prev = failureCache.get(key);
        failureCache.set(key, { at: Date.now(), count: (prev?.count || 0) + 1 });
      }
      setImageUrl(url);
    });
  }, [artist.mbid, artist.name, enabled, forceFetch, imageUrl]);

  return imageUrl;
}
