'use client';

import { useEffect, useState } from 'react';
import type { Artist } from '@/lib/types';
import { normalizeImageUrl, toImageProxyUrl } from '@/lib/images';

const imageCache = new Map<string, string | null>();
type FetchResult = {
  url: string | null;
};
const inFlight = new Map<string, Promise<FetchResult>>();
const queue: Array<() => Promise<void>> = [];
let activeCount = 0;
const MAX_CONCURRENT = 3;
const STAGGER_MS = 150;
const TRANSIENT_RETRY_DELAY_MS = 800;
const TRANSIENT_RETRY_WINDOW_MS = 6_000;
const MAX_TRANSIENT_RETRIES = 2;
const retryStateCache = new Map<string, { count: number; at: number }>();

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
  const initial = toImageProxyUrl(normalizeImageUrl(artist.imageUrl || artist.image)) || null;
  const [imageUrl, setImageUrl] = useState<string | null>(initial);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const nextInitial = toImageProxyUrl(normalizeImageUrl(artist.imageUrl || artist.image)) || null;
    if (nextInitial) {
      setImageUrl(nextInitial);
    }
  }, [artist.mbid, artist.name, artist.imageUrl, artist.image]);

  useEffect(() => {
    if (!enabled) return;
    if (imageUrl && !forceFetch) return;

    const key = getCacheKey(artist);
    if (!key) return;

    if (!forceFetch && imageCache.has(key)) {
      setImageUrl(imageCache.get(key) || null);
      return;
    }

    let request = inFlight.get(key);
    if (!request) {
      const params = new URLSearchParams();
      if (artist.mbid) params.set('mbid', artist.mbid);
      if (artist.name) params.set('name', artist.name);

      request = new Promise<FetchResult>((resolve) => {
        enqueue(async () => {
          try {
            const response = await fetch(`/api/artist-image?${params.toString()}`);
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
              resolve({ url: null });
              return;
            }
            const data = payload?.ok ? payload.data : payload;
            const normalized = normalizeImageUrl(data?.imageUrl);
            const url = toImageProxyUrl(normalized) || normalized || null;
            resolve({ url });
          } catch {
            resolve({ url: null });
          } finally {
            inFlight.delete(key);
          }
        });
      });

      inFlight.set(key, request);
    }

    request.then((result) => {
      if (result.url) {
        imageCache.set(key, result.url);
        retryStateCache.delete(key);
      } else {
        const now = Date.now();
        const retryState = retryStateCache.get(key) || { count: 0, at: 0 };
        if (retryState.count < MAX_TRANSIENT_RETRIES || now - retryState.at > TRANSIENT_RETRY_WINDOW_MS) {
          retryStateCache.set(key, { count: (retryState.count || 0) + 1, at: now });
          setTimeout(() => {
            const known = imageCache.get(key);
            if (!known) {
              setRetryNonce((value) => value + 1);
            }
          }, TRANSIENT_RETRY_DELAY_MS);
        }
      }
      setImageUrl(result.url);
    });
  }, [artist.mbid, artist.name, enabled, forceFetch, imageUrl, retryNonce]);

  return imageUrl;
}
