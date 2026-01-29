'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';

type FallbackImageProps = Omit<ImageProps, 'src' | 'alt'> & {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
};

const BYPASS_OPT_HOSTS = new Set(['archive.org', 'coverartarchive.org']);

function shouldBypassOptimization(src?: string | null): boolean {
  if (!src) return false;
  try {
    const url = new URL(src);
    return BYPASS_OPT_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function FallbackImage({
  src,
  alt,
  fallbackSrc = '/placeholder.svg',
  onError,
  ...props
}: FallbackImageProps) {
  const [errored, setErrored] = useState(false);
  const resolvedSrc = !errored && src ? src : fallbackSrc;
  const bypassOptimization = shouldBypassOptimization(resolvedSrc);
  const unoptimized = props.unoptimized || bypassOptimization;

  useEffect(() => {
    setErrored(false);
  }, [src]);

  return (
    <Image
      {...props}
      unoptimized={unoptimized}
      src={resolvedSrc}
      alt={alt}
      onError={(event) => {
        setErrored(true);
        onError?.(event);
      }}
    />
  );
}
