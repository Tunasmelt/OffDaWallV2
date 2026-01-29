'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[OffDaWallV2] Application error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          {/* Logo */}
          <Link href="/">
            <Image
              src="/logo-transparent-v2.png"
              alt="OffDaWall"
              width={240}
              height={80}
              className="h-16 w-auto mx-auto mb-8"
              priority
            />
          </Link>

          {/* Error Message */}
          <div className="mb-8">
            <div 
              className="inline-block text-primary font-bold uppercase text-sm tracking-wider px-4 py-1 border-2 border-primary transform -rotate-2 mb-6"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              Something Went Wrong
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4">
              Error Loading
            </h1>
            
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              We hit a snag while loading this content. Try again or head back home.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-bold hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-card border-2 border-border px-6 py-3 font-bold hover:border-primary transition-colors"
              >
                ← Back to Home
              </Link>
            </div>
          </div>

          {/* Error Details (Development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-card border border-border text-left">
              <div className="text-sm font-mono text-muted-foreground overflow-auto">
                <div className="font-bold mb-2">Error Details:</div>
                <div>{error.message}</div>
                {error.digest && (
                  <div className="mt-2">
                    <span className="font-bold">Digest:</span> {error.digest}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

