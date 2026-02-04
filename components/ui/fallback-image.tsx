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
  const isLocalQueryPath = resolvedSrc.startsWith('/') && resolvedSrc.includes('?');

  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (isLocalQueryPath) {
    const { fill, className, style, sizes } = props;
    return (
      <img
        src={resolvedSrc}
        alt={alt}
        className={className}
        sizes={typeof sizes === 'string' ? sizes : undefined}
        style={
          fill
            ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }
            : style
        }
        onError={(event) => {
          setErrored(true);
          onError?.(event as any);
        }}
      />
    );
  }

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
