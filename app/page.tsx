import Image from 'next/image';
import Link from 'next/link';
import { HomeGenreGrid } from '@/components/home-genre-grid';
import { SearchBar } from '@/components/search-bar';
import { MobileMenu } from '@/components/mobile-menu';
import { getAllGenres, TAXONOMY_CACHE_TAG } from '@/lib/genres';
import { getBaseUrl } from '@/lib/server/base-url';
import type { Genre } from '@/lib/types';
import type { GenresPreviewDTO, ApiResponse } from '@/lib/contracts/api';

async function getGenrePreviews(): Promise<{ genres: Genre[]; status?: string }> {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/genres?preview=1`, {
      next: { revalidate: 3600, tags: [TAXONOMY_CACHE_TAG] },
    });
    if (!res.ok) {
      return { genres: getAllGenres(), status: 'empty' };
    }
    const payload = (await res.json()) as ApiResponse<GenresPreviewDTO>;
    if (payload?.ok === true && Array.isArray(payload?.data?.genres)) {
      return { genres: payload.data.genres as Genre[], status: payload.meta?.status };
    }
    return { genres: getAllGenres(), status: 'empty' };
  } catch {
    return { genres: getAllGenres(), status: 'empty' };
  }
}

export default async function Page() {
  const preview = await getGenrePreviews();
  const genres = preview.genres;

  return (
    <main className="min-h-screen bg-background">
      {/* Header with Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/">
              <Image
                src="/logo-transparent-v2.png"
                alt="OffDaWall"
                width={240}
                height={80}
                className="h-12 md:h-14 w-auto"
                priority
              />
            </Link>
            
            {/* Desktop Search & Navigation */}
            <div className="hidden md:flex items-center gap-6 flex-1 max-w-2xl mx-8">
              <SearchBar />
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <a href="#genres" className="text-sm font-medium hover:text-primary transition-colors">
                Genres
              </a>
              <a href="#about" className="text-sm font-medium hover:text-primary transition-colors">
                About
              </a>
            </nav>

            {/* Mobile Menu */}
            <MobileMenu />
          </div>

          {/* Mobile Search */}
          <div className="md:hidden mt-4">
            <SearchBar />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Background texture */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fillOpacity='1' fillRule='evenodd'/%3E%3C/svg%3E")`,
          }}
        />
        
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl">
            {/* Handwritten annotation */}
            <div className="inline-block mb-4">
              <div 
                className="text-primary text-sm font-bold uppercase tracking-wider px-4 py-1 border-2 border-primary transform -rotate-2"
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                Real Hip-Hop Discovery
              </div>
            </div>
            
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-foreground mb-6 text-balance leading-none">
              Find Artists
              <br />
              <span className="text-primary">OffDaWall</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl text-pretty">
              Explore top and upcoming artists across every hip-hop subgenre. 
              From trap to boom bap, drill to cloud rap. Discover hidden gems 
              and underground talent powered by real music data.
            </p>
          </div>
        </div>
        
        {/* Decorative element */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </section>

      {/* Genre Discovery Section */}
      <section id="genres" className="container mx-auto px-4 py-20 md:py-32">
        {/* Section Header */}
        <div className="mb-16 relative">
          {/* Handwritten annotation */}
          <div 
            className="absolute -top-8 left-0 text-primary font-bold uppercase text-xs tracking-wider transform -rotate-3"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            Choose Your Sound →
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
            Explore Genres
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Dive into 10 distinct hip-hop subgenres. Each one showcasing top artists 
            and emerging talent ready to be discovered.
          </p>
        </div>

        {/* Genre Grid with Collage Layout */}
        <HomeGenreGrid initialGenres={genres} initialStatus={preview.status} />
      </section>

      {/* About Section */}
      <section id="about" className="border-t border-border">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block mb-6">
              <div 
                className="text-primary font-bold uppercase text-sm tracking-wider px-4 py-1 border-2 border-primary transform rotate-1"
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                Real Data, Real Artists
              </div>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
              Powered by Music Intelligence
            </h2>
            
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              OffDaWall aggregates data from MusicBrainz, AudioDB, and Deezer to bring 
              you comprehensive artist profiles, complete catalogs, and intelligent 
              recommendations. No guesswork, just pure hip-hop discovery.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div className="p-6 bg-card border border-border">
                <div className="text-3xl font-black text-primary mb-2">10+</div>
                <div className="text-sm font-medium">Hip-Hop Subgenres</div>
              </div>
              <div className="p-6 bg-card border border-border">
                <div className="text-3xl font-black text-primary mb-2">1000s</div>
                <div className="text-sm font-medium">Artist Profiles</div>
              </div>
              <div className="p-6 bg-card border border-border">
                <div className="text-3xl font-black text-primary mb-2">AI</div>
                <div className="text-sm font-medium">Recommendations</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image
                src="/logo-transparent-v2.png"
                alt="OffDaWall"
                width={120}
                height={40}
                className="h-8 w-auto"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Discover hip-hop artists OffDaWall. Data powered by MusicBrainz, AudioDB & Deezer.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
