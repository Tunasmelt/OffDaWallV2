'use client';

import React from "react"

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface PrefetchLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetchDelay?: number;
}

/**
 * Link component with hover prefetching
 */
export function PrefetchLink({ 
  href, 
  children, 
  className,
  prefetchDelay = 200 
}: PrefetchLinkProps) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    // Prefetch after a short delay to avoid excessive prefetching
    timeoutRef.current = setTimeout(() => {
      router.prefetch(href);
    }, prefetchDelay);
  };

  const handleMouseLeave = () => {
    // Clear timeout if user moves away quickly
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Link
      href={href}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      prefetch={false}
    >
      {children}
    </Link>
  );
}

// Default export for compatibility
export default PrefetchLink;
