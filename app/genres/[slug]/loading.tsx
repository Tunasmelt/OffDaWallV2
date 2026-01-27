import Image from 'next/image';
import Link from 'next/link';
import { ArtistSkeleton } from '@/components/artist-skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Image
                src="/logo-transparent.png"
                alt="OffDaWall"
                width={180}
                height={60}
                className="h-12 w-auto"
                priority
              />
            </Link>
            <Link
              href="/"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              ← Back to Genres
            </Link>
          </div>
        </div>
      </header>

      {/* Loading Hero */}
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-32" />
            <div className="h-20 bg-muted rounded w-3/4" />
            <div className="h-8 bg-muted/60 rounded w-2/3" />
          </div>
        </div>
      </section>

      {/* Loading Artists */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mb-12 space-y-3 animate-pulse">
          <div className="h-12 bg-muted rounded w-64" />
          <div className="h-6 bg-muted/60 rounded w-96" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-12">
          <ArtistSkeleton count={8} />
        </div>
      </section>
    </main>
  );
}
