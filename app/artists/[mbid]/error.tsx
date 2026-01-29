'use client';

import Link from 'next/link';

export default function ArtistError() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-black mb-3">Artist Unavailable</h1>
        <p className="text-muted-foreground mb-6">
          We couldn&apos;t load this artist right now. Try again in a moment.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
