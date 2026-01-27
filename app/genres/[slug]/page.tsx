import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getGenreBySlug } from '@/lib/genres';
import { ArtistCard } from '@/components/artist-card';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { SearchBar } from '@/components/search-bar';
import { MobileMenu } from '@/components/mobile-menu';
import { generateGenreMetadata } from '@/lib/metadata';
import type { Artist } from '@/lib/types';

async function getGenreData(slug: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/genres/${slug}`, {
      next: { revalidate: 86400 }, // Revalidate every 24 hours
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.json();
  } catch (error) {
    console.error('[OffDaWallV2] Failed to fetch genre data:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const genre = getGenreBySlug(params.slug);
  
  if (!genre) {
    return {
      title: 'Genre Not Found',
    };
  }
  
  return generateGenreMetadata(genre.name, genre.description);
}

export default async function GenrePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  
  const genre = getGenreBySlug(slug);
  
  if (!genre) {
    notFound();
  }
  
  const data = await getGenreData(slug);
  
  const topArtists: Artist[] = data?.topArtists || [];
  const upcomingArtists: Artist[] = data?.upcomingArtists || [];
  const totalCount = data?.totalCount || 0;
  
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
                width={180}
                height={60}
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

      {/* Genre Hero */}
      <section className="relative border-b border-border overflow-hidden">
        {/* Background pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V%200h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V%200H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-4xl">
            <Breadcrumbs items={[
              { label: 'Genres', href: '/#genres' },
              { label: genre.name }
            ]} />

            {/* Handwritten label */}
            <div 
              className="inline-block mb-4 text-primary font-bold uppercase text-sm tracking-wider px-3 py-1 border-2 border-primary transform -rotate-2"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {totalCount}+ Artists
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-none">
              {genre.name}
              <span className="text-primary">.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl text-pretty">
              {genre.description}
            </p>
          </div>
        </div>
      </section>

      {/* Top Artists Section */}
      {topArtists.length > 0 && (
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="mb-12 relative">
            {/* Handwritten annotation */}
            <div 
              className="absolute -top-6 left-0 text-primary font-bold uppercase text-xs tracking-wider transform -rotate-2"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              Most Popular →
            </div>
            
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-3">
              Top Artists
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The biggest names in {genre.name} right now
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-12">
            {topArtists.map((artist, index) => (
              <ArtistCard
                key={artist.mbid}
                artist={artist}
                index={index}
                featured={index < 3}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Artists Section */}
      {upcomingArtists.length > 0 && (
        <section className="container mx-auto px-4 py-16 md:py-24 border-t border-border">
          <div className="mb-12 relative">
            {/* Handwritten annotation */}
            <div 
              className="absolute -top-6 left-0 text-primary font-bold uppercase text-xs tracking-wider transform rotate-1"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              On The Rise →
            </div>
            
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-3">
              Upcoming Artists
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Rising talent pushing {genre.name} forward
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-12">
            {upcomingArtists.map((artist, index) => (
              <ArtistCard
                key={artist.mbid}
                artist={artist}
                index={index}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {topArtists.length === 0 && upcomingArtists.length === 0 && (
        <section className="container mx-auto px-4 py-24">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-6xl mb-6">🎤</div>
            <h2 className="text-3xl font-black mb-4">No Artists Found</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              We couldn't find any artists in this genre right now. 
              Check back later or explore other genres.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
            >
              ← Explore Other Genres
            </Link>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-16">
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
              Discover hip-hop artists OffDaWall
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}


