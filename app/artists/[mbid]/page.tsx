import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
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
import type { Artist } from '@/lib/types';

async function getArtist(mbid: string): Promise<Artist | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000';
    
    const res = await fetch(`${baseUrl}/api/artists/${mbid}`, {
      next: { revalidate: 86400 }, // 24 hours
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch (error) {
    console.error('[OffDaWallV2] Error fetching artist:', error);
    return null;
  }
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ mbid: string }> 
}): Promise<Metadata> {
  const { mbid } = await params;
  const artist = await getArtist(mbid);

  if (!artist) {
    return {
      title: 'Artist Not Found - OffDaWall',
    };
  }

  return generateArtistMetadata(artist.name, artist.bio, artist.imageUrl);
}

export default async function ArtistPage({ 
  params 
}: { 
  params: Promise<{ mbid: string }> 
}) {
  const { mbid } = await params;
  const artist = await getArtist(mbid);

  if (!artist) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/">
              <Image
                src="/logo-transparent.png"
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
                src="/logo-transparent.png"
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

