import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArtistHero } from '@/components/artist-hero';
import { ArtistBio } from '@/components/artist-bio';
import { RelatedArtists } from '@/components/related-artists';
import { CareerTimeline } from '@/components/career-timeline';
import { ArtistCatalog } from '@/components/artist-catalog';
import { ArtistRecommendations } from '@/components/artist-recommendations';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { SearchBar } from '@/components/search-bar';
import { MobileMenu } from '@/components/mobile-menu';
import { generateArtistMetadata } from '@/lib/metadata';
import { getBaseUrl } from '@/lib/server/base-url';
import type { Artist } from '@/lib/types';
import { isValidUuid } from '@/lib/ids';
import { isDebugMode } from '@/lib/observability';

type ArtistFetchResult = {
  status: number;
  artist: Artist | null;
  error?: {
    code?: string;
    message?: string;
    provider?: string;
  };
  meta?: {
    providersUsed?: string[];
  };
};

const getArtist = cache(async (mbid: string): Promise<ArtistFetchResult> => {
  try {
    const baseUrl = getBaseUrl();
    
    const res = await fetch(`${baseUrl}/api/artists/${mbid}`, {
      next: { revalidate: 86400 }, // 24 hours
    });

    const status = res.status;
    const payload = await res.json().catch(() => null);
    if (res.ok && payload?.ok === true) {
      return { status, artist: payload.data, meta: payload?.meta };
    }
    return {
      status,
      artist: null,
      error: payload?.error,
      meta: payload?.meta,
    };
  } catch (error) {
    console.error('[OffDaWallV2] Error fetching artist:', error);
    return { status: 503, artist: null, error: { message: 'fetch_failed' } };
  }
});

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ mbid: string }> 
}): Promise<Metadata> {
  const { mbid } = await params;
  const decoded = decodeURIComponent(mbid);
  if (!isValidUuid(decoded)) {
    return { title: 'Bad Artist ID - OffDaWall' };
  }
  const { artist } = await getArtist(decoded);

  if (!artist) {
    return {
      title: 'Artist Temporarily Unavailable - OffDaWall',
    };
  }

  return generateArtistMetadata(artist.name, artist.bio, artist.imageUrl, artist.mbid);
}

export default async function ArtistPage({ 
  params 
}: { 
  params: Promise<{ mbid: string }> 
}) {
  const { mbid } = await params;
  const decoded = decodeURIComponent(mbid);

  if (!isValidUuid(decoded)) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl md:text-5xl font-black mb-4">Bad Artist ID</h1>
          <p className="text-muted-foreground mb-8">
            The link you opened is not a valid artist ID.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const { artist, status, error, meta } = await getArtist(decoded);

  if (!artist) {
    if (status === 404) {
      notFound();
    }
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl md:text-5xl font-black mb-4">Artist Temporarily Unavailable</h1>
          <p className="text-muted-foreground mb-8">
            We couldn&apos;t load this artist right now. Please try again.
          </p>
          {isDebugMode() && (
            <div className="mx-auto mb-8 max-w-xl text-left text-xs text-muted-foreground border border-border bg-card p-4">
              <div className="font-bold text-sm mb-2">Debug</div>
              <div>mbid: {decoded}</div>
              <div>status: {status}</div>
              <div>error.code: {error?.code || 'n/a'}</div>
              <div>error.provider: {error?.provider || 'n/a'}</div>
              <div>providersUsed: {(meta?.providersUsed || []).join(', ') || 'n/a'}</div>
            </div>
          )}
          <Link
            href={`/artists/${decoded}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
          >
            ↻ Retry
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/">
              <Image
                src="/logo-transparent-v2.png"
                alt="OffDaWall"
                width={200}
                height={67}
                className="h-10 md:h-12 w-auto"
                priority
              />
            </Link>

            {/* Desktop Search */}
            <div className="hidden md:flex items-center gap-4 flex-1 max-w-xl mx-8">
              <SearchBar />
            </div>

            {/* Desktop Back Link */}
            <Link 
              href="/"
              className="hidden md:inline-flex text-sm font-medium hover:text-primary transition-colors"
            >
              ← Back to Home
            </Link>

            {/* Mobile Menu */}
            <MobileMenu />
          </div>

          {/* Mobile Search */}
          <div className="md:hidden mt-4">
            <SearchBar />
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 pt-8">
        <Breadcrumbs items={[
          { label: 'Artists', href: '/' },
          { label: artist.name }
        ]} />
      </div>

      {/* Artist Hero */}
      <ArtistHero artist={artist} />

      {/* Biography */}
      <ArtistBio artist={artist} />

      {/* Career Timeline */}
      <CareerTimeline artist={artist} />

      {/* Music Catalog */}
      <section className="container mx-auto px-4 py-12 md:py-16 border-t border-border">
        <ArtistCatalog artistMbid={artist.mbid} artistName={artist.name} />
      </section>

      {/* AI Recommendations */}
      <section className="container mx-auto px-4 py-12 md:py-16 border-t border-border">
        <ArtistRecommendations artistMbid={artist.mbid} artistName={artist.name} />
      </section>

      {/* Related Artists */}
      {artist.relatedArtists && artist.relatedArtists.length > 0 && (
        <section className="border-t border-border">
          <RelatedArtists relatedArtists={artist.relatedArtists} />
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/">
              <Image
                src="/logo-transparent-v2.png"
                alt="OffDaWall"
                width={120}
                height={40}
                className="h-8 w-auto"
              />
            </Link>
            <p className="text-sm text-muted-foreground">
              Discover hip-hop artists OffDaWall. Data powered by MusicBrainz, AudioDB & Deezer.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

